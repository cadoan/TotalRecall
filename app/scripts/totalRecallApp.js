/*jshint -W109 */
define(['jquery'], function ($) {
	'use strict';


/* FOR PRODUCTION:  Override of console.log
***************************************************************/
	// var console = {};
	// console.log = function(){};
/**************************************************************/


/* CLASS: TOTAL RECALL GAME
***************************************************************/
	function TotalRecallGame(userOptions){


		var $game = {
			gameboard: null,
			dialogbox: null,
			signin: null,
			wait: null,
			endgame: null,
			rowTemplate: null,
			cardTemplate: null
		};

		// var $gameboard;
		// var $dialogbox;
		// var $signin;
		// var $wait;
		// var $endgame;
		// var $rowTemplate;
		// var $cardTemplate;

		var username;
		var gameDetails = {};
		var cardsURL;
		var cardsData = {};
		var allowGuess = true;
		var firstCard = { id: null, $card: null, value: null};
		var secondCard = { id: null, $card: null, value: null};
		var cardsLeft;
		var animationDuration = 500;

		var solverUnseenQueue;
		var solverRemainingQueue;
		var solverMemory = {};
		var solverMatchesList = [];
		var solverActive = false;

		var options = {
			URL: "http://totalrecall.99cluster.com/games/",
			gameboard: "gameboard",
			dialogbox: "dialogbox",
			signin: "signin",
			wait: "wait",
			endgame: "endgame",
			rowTemplate: "rowTemplate",
			cardTemplate: "cardTemplate"
		};
		$.extend(true, options, userOptions);


		//SETUP
		this.init = function(){

			//Link up jQuery objects to the IDs set in options
			for(var prop in $game){
				$game[prop] = $("#" + options[prop]);
			}

			$game.signin.find("input[type=submit]").on("click", handleSignin);
			$("#gameboard").on("click", ".card", cardClicked);
			$("#solve").on("click", solveGame);
			$("#submit-again").on("click", playAgain);
		};


		// GET THE DURATION OF CARD FLIP ANIMATIONS
		// (assumption: css value is a valid, properly formatted value)
		function getAnimDuration(){
			
			var time =  $(".card").css("transition-duration");
			if ( time.indexOf("ms") > 0){
				animationDuration = parseInt(time, 10);
			}
			else if ( time.indexOf("s") > 0 ){
				animationDuration = parseFloat(time, 10) * 1000;
			}
		}


		// SHOW MESSAGE IN GAME STATUS-BAR AREA
		function showMessage(message, delay){

			setTimeout(
				function(){	$("#message").text(message); },
				(delay || 0)  //default of no delay
			);
		}


		// PREP SCREEN FOR GAME
		function handleSignin(event){
			event.preventDefault();

			//Save users name
			username = $("#name").val();
			showMessage("Welcome " + username);

			//Show wait spinner
			$("#signin").hide();
			$("#wait").show();

			getGame();
		}


		// GET THE GAME DATA VIA AJAX CALL
		function getGame(){

			var signinDetails = $("#signin").serialize();
			$.support.cors = true;
			$.ajax({
				url: options.URL,
				type: "POST",
				data: signinDetails,
				success: initGame,
				error: handleInitAjaxError
			});
		}


		function handleInitAjaxError(jqXHR, status, error){
			console.log("game init ajax error:", status, error);
		}


		function initGame(gameData){
			
			var $rowsHolder = $("<div/>");  //Temporary holder for rows markup
			var cardID;
			var rowTemplate;
			var rowInner;
			var cardTemplate;

			$("#wait").hide();
			$("#dialogbox").hide();

			//Reset card data
			cardsData = {};
			firstCard.id = secondCard.id = null;
			firstCard.$card = secondCard.$card = null;
			firstCard.value = secondCard.value = null;

			checkGameData(gameData);
			gameDetails = gameData;
			cardsURL = options.URL + gameDetails.id + "/cards/";
			cardsLeft = gameData.height * gameData.width;

			cardTemplate = $("#cardTemplate").html();
			rowTemplate = $("#rowTemplate").html();

			//FILL GAME BOARD WITH CARDS
			// I wasn't sure if a templating system like Handlebars was allowed, so I did it manually
			for(var y = 0; y < gameData.height; y++){

				rowInner = "";
				
				for(var x = 0; x < gameData.width; x++){
					
					cardID = "card-" + x +"-" + y;

					//Save the card's coordinates so they dont have to be recomputed later
					cardsData[cardID] = {coords:  {x: x, y: y}, value: null, matched: false, seen: false};
					
					//Add card to row
					rowInner += cardTemplate.replace("%CARDID%", cardID);
				}

				$rowsHolder.append( $(rowTemplate).append(rowInner) );
			}

			//Add cards to gameboard
			$("#gameboard").html( $rowsHolder.html() );
			setGameboardProperties();
			$("#gameboard").addClass("gameboard--show");

			allowGuess = true;
			solverActive = false;

			$("#solve-message").addClass("footer__title--preshow footer__title--show");
			showMessage("Pick a card " + username);
		}


		//SET GAMEBOARD ATTRIBUTES
		function setGameboardProperties(){

			var margin, totalMarginsWidth, totalMarginsHeight;
			var padding;
			var totalCardsWidth, cardWidth;
			var totalCardsHeight, cardHeight;
			var maxWidth, maxHeight;
			var $card;

			//Get animation timing info
			getAnimDuration();

			//SIZING
			//Gameboard area sizing
			$("#gameboard").addClass("gameboard--fullheight");

			//Card sizing
			$card = $(".card").first();
			maxWidth = parseInt( $card.css("max-width"), 10);
			maxHeight = parseInt( $card.css("max-height"), 10);

			//Width
			margin = parseInt( $card.css("margin-right"), 10);
			totalMarginsWidth = margin * (gameDetails.width - 1);
			totalCardsWidth = $("#gameboard").parent().width() - totalMarginsWidth;
			cardWidth = Math.floor( totalCardsWidth / gameDetails.width );
			cardWidth = Math.min( cardWidth, maxWidth );

			//Height
			var $row = $(".row").first();
			margin = parseInt( $row.css("margin-bottom"), 10);
			totalMarginsHeight = margin * (gameDetails.height - 1);
			padding = parseInt( $("#gameboard").css("padding-top"), 10) + parseInt( $("#gameboard").css("padding-bottom"), 10);

			totalCardsHeight = $("#gameboard").parent().height() - totalMarginsHeight - padding;
			cardHeight = Math.floor( totalCardsHeight / gameDetails.height );
			cardHeight = Math.min( cardHeight, maxHeight );

			$(".card").each(function(){
				$(this)
					.width(cardWidth)
					.height(cardHeight)
					.find(".card__face--front").css("line-height", (cardHeight-10) +"px");  //-10px for line height for font adjustment
			});
				
		}


		// VALIDATE GAME DATA
		function checkGameData(gameData){

			if (!gameData.id || isNaN(gameData.width) || isNaN(gameData.height)){
				console.log("error with game data");
				console.log(gameData);
			}
			else{
				console.log("game data okay");
			}
		}


		//SINGLE CARD CLICK HANDLER
		function cardClicked(event){

			//No clicks allowed if already handling a pair of cards 
			if(!allowGuess){
				console.log("game busy, guessing not allowed yet");
				return;
			}

			//No manual user clicks allowed if auto solver in action
			if(solverActive && event.originalEvent){
				console.log("auto solver active. no manual clicks allowed.");
				return;
			}

			//Block further clicks while this card is handled
			allowGuess = false;

			var $card = $(event.currentTarget);

			//No clicks allowed on currently showing cards or matched cards
			if( $card.hasClass("card--showing") || $card.hasClass("card--matched")){
				console.log('card already showing or matched');
				return;
			}

			showMessage("Loading your card...");

			var cardID = $card.attr("id");
			var targetURL = cardsURL + cardsData[cardID].coords.x + "," + cardsData[cardID].coords.y;

			$.ajax({
				crossDomain: true,
				url: targetURL,
				type: "GET",
				success: function(data){

					cardsData[cardID].value = data; //Save the value first
					cardsData[cardID].seen = true;
					showCard( $card, data);
				},
				error: cardAjaxError
			});
		}


		function cardAjaxError(jqXHR, status, error){
			console.log("something went wrong looking up the card: ", status, error);
		}


		// TRIGGER CARD ANIMATION
		function showCard($card, value){

			//Show new card
			$card
				.addClass("card--showing card--flipped")
				.find(".card__face--front").text(value);
				
			//Is first card of current pair of clicks
			if(!firstCard.id){
				firstCard.id = $card.attr("id");
				firstCard.$card = $card;
				firstCard.value = value;
				allowGuess = true;
				$("#gameboard").trigger("gameready");

				showMessage("Pick the matching card");
			}

			//Is second card of current pair of clicks
			else{
				secondCard.id = $card.attr("id");
				secondCard.$card = $card;
				secondCard.value = value;
				checkPair();
			}
		}


		// COMPARE EACH PAIR OF CARDS
		function checkPair(){
 
			//Mismatch
			if( firstCard.value !== secondCard.value){
				//Save card info for the auto-solver
				saveForSolver();
				showMessage("Darn, no match. Try again.", animationDuration);
				setTimeout( hidePair, 1000);
			}

			//Match found
			else{
				showMessage("Woohoo!  Pair matched!", animationDuration);
				setTimeout( pairMatched, 1000);
			}
		}


		//NO MATCH FOUND
		function hidePair(){
			
			firstCard.$card.removeClass("card--showing card--flipped");
			secondCard.$card.removeClass("card--showing card--flipped");

			//reset pair
			firstCard.id = secondCard.id = null;
			firstCard.$card = secondCard.$card = null;
			firstCard.value = secondCard.value = null;
			allowGuess = true;
			$("#gameboard").trigger("gameready");
		}


		//MATCH FOUND
		function pairMatched(){

			//Mark the cards as matched
			firstCard.$card
				.removeClass("card--inplay")
				.addClass("card--matched");

			secondCard.$card
				.removeClass("card--inplay")
				.addClass("card--matched");

			cardsData[firstCard.id].matched = cardsData[secondCard.id].matched = true;

			//reset pair
			firstCard.id = secondCard.id = null;
			firstCard.$card = secondCard.$card = null;
			firstCard.value = secondCard.value = null;

			cardsLeft -= 2;

			//More matches to be made
			if(cardsLeft > 2){
				allowGuess = true;
				showMessage("Pick another card", animationDuration);
				setTimeout(function(){$("#gameboard").trigger("gameready");}, 200);
			}

			//All pairs identified, game over
			else{
				endGame();
			}
		}
 
		//ALL MATCHES FOUND, WRAP UP.
		function endGame(){

			//Turn off auto solver
			solverActive = false;
			$("#gameboard").off("gameready", pickNextCard);

			//Get last pair
			var lastCards = $("#gameboard .card--inplay");

			console.log("lastcards: ", lastCards);

			if( lastCards.length !== 2 ){
				console.log("error ending game. there are not exactly two cards left");
				return;
			}

			$(lastCards[0]).removeClass("card--inplay").addClass("card--matched");
			$(lastCards[1]).removeClass("card--inplay").addClass("card--matched");

			var cardData = cardsData[ $(lastCards[0]).attr("id") ];
			var coordsString = "x1=" + cardData.coords.x + "&y1=" + cardData.coords.y;

			cardData = cardsData[ $(lastCards[1]).attr("id") ];
			coordsString += "&x2=" + cardData.coords.x + "&y2=" + cardData.coords.y;

			$.ajax({
				url: options.URL + gameDetails.id + "/end",
				type: "POST",
				data: coordsString,
				success: endGameResult,
				error: endGameError
			});

		}


		//CHECK RETURNED RESULT FROM AJAX
		function endGameResult(data){

			console.log("success: ", data.success);

			if (data.success){
				showMessage("");
				$("#endgame").show();
				$("#dialogbox")
					.addClass("dialogbox--whiteshadow")
					.fadeIn(500);
			}
			else{
				console.log("error ending game");
			}
		}


		function endGameError(jqXHR, status, error){
			console.log("error ending game: ", status, error);
		}


		//FINISH GAME AUTOMATICALLY
		function solveGame(){

			if( cardsLeft > 2){
				
				//Init solver variables
				solverUnseenQueue = null;
				solverRemainingQueue = null;
				solverMemory = {};
				solverMatchesList = [];
				solverActive = true;

				$("#solve-message").removeClass("footer__title--show footer__title--preshow");

				//Prep handlers for saving card data and picking next cards
				$("#gameboard").on("gameready", pickNextCard);

				//Create random list of cards to pick
				generateSolverUnseenQueue();

				//Go head and pick first card
				pickNextCard();
			}
		}

		
		//SAVE CARDS TO SOLVER MEMORY
		function saveForSolver(){
			
			//Haven't seen this letter before, just save to memory
			if( !solverMemory[firstCard.value] ){
				solverMemory[firstCard.value] = firstCard.id;
			}

			//Have seen this letter before, add it to our list of known matches
			else{
				solverMatchesList.push( firstCard.id );
			}

			//Haven't seen this letter before, just save to memory
			if( !solverMemory[secondCard.value] ){
				solverMemory[secondCard.value] = secondCard.id;
			}

			//Have seen this letter before, add it to our list of known matches
			else{
				solverMatchesList.push( secondCard.id );
			}
		}


		//AUTO-SOLVER: PICK NEXT CARD
		function pickNextCard(){

			var match;

			//Stop when only 2 cards left
			if(cardsLeft <= 2){
				return;
			}

			//Picking first card
			if(!firstCard.id){
				$("#"+pickCard()).click();
			}

			//Picking second card
			else{
				//Have I seen a matching card?
				match = solverMemory[ firstCard.value ];

				//Matching value found, pick that card
				if(match){
					$("#"+match).click();
				}

				//No match, pick card at random
				else{
					$("#"+pickCard()).click();
				}
			}

		}


		//PICK A CARD AT RANDOM (ONE THAT HASN'T BEEN SEEN BEFORE)
		function pickCard(){

			var cardID;

			// If a match is known, pick one of those
			if( solverMatchesList.length > 0){
				cardID = solverMatchesList.pop();
				return cardID;
			}
			

			// Otherwise get a card from the random (unseen cards) list...
			if( solverUnseenQueue.length > 0 ){
				
				do{
					cardID = solverUnseenQueue.pop();
					console.log("solver unseen cards pop:", cardID);
				} while( cardID && cardsData[cardID].seen === true );
			}


			// ...but if we've run out of unseen cards, go back over one of the remaining (seen) cards
			if( !cardID ) {

				console.log("going back to remaning seen cards");

				if( !solverRemainingQueue || solverRemainingQueue.length < 1 ){
					generateRemainingQueue();
				}

				cardID = solverRemainingQueue.pop();
				console.log("solver seen cards pop:", cardID);

				//if we've run out of unseen and seen cards, somethings broken
				if(!cardID){
					console.log('Somethings gone wrong, game should be over already.');
				}
			}

			console.log("card picked: ", cardID);
			return cardID;
		}


		// GENERATES A RANDOMISED LIST OF CARDS FOR USE BY AUTO-SOLVER ROUTINE
		function generateSolverUnseenQueue(){

			var numCards = gameDetails.width * gameDetails.height;
			var x;
			var y;
			var cardID;
			var pos;

			//Create array for randomised list
			solverUnseenQueue = new Array(numCards);

			//Assign every card ID into randomised list
			for(y = 0; y < gameDetails.height; y++){
				for(x = 0; x < gameDetails.width; x++){

					cardID = "card-" + x +"-" + y;
					
					//Get random position
					do{
						pos = Math.floor(Math.random() * numCards);
					} while ( solverUnseenQueue[pos] !== undefined);

					solverUnseenQueue[pos] = cardID;
				}
			}
		}


		// GENERATES A LIST OF THE REMAINING UNMATCHED CARDS
		function generateRemainingQueue(){

			solverRemainingQueue = [];

			$(".card--inplay:not(.card--showing)").each(function(){
				solverRemainingQueue.push( $(this).attr("id") );
			});
		}


		// RESET GAME BOARD
		function playAgain(event){
			event.preventDefault();

			//Show wait spinner
			$("#endgame").hide();
			$("#wait").show();

			$("#gameboard").empty();

			showMessage("Getting your new game now...");
			getGame();
		}
	}
/* end TOTAL RECALL GAME CLASS ********************************************/

	return new TotalRecallGame();
});