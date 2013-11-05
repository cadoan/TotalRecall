/*jshint -W109 */
define(['jquery', 'utilities'], function ($, Utilities) {
	'use strict';


/* FOR PRODUCTION:  Override of console.log
***************************************************************/
	// var console = {};
	// console.log = function(){};
/**************************************************************/


/* CLASS: TOTAL RECALL GAME
***************************************************************/
	function TotalRecallGame(userOptions){

		var username;
		var gameDetails = {};
		var cardsURL;
		var cardsData = {};
		var allowGuess = true;
		var firstCard = { id: null, $card: null, value: null};
		var secondCard = { id: null, $card: null, value: null};
		var cardsLeft;
		var animationDuration = 500;

		var solverQueue;
		var solverMemory = {};
		var solverMatchesList = [];
		var solverActive = false;

		var options = {
			URL: "http://totalrecall.99cluster.com/games/",
			cardMargin: 10
		};
		$.extend(true, options, userOptions);


		//SETUP
		this.init = function(){
			$("#submit-signin").on("click", handleSignin);
			$("#gameboard").on("click", ".card", cardClicked);
			$("#solve").on("click", solveGame);
			$("#submit-again").on("click", playAgain);
			getAnimDuration();
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
			
			var cardsHTML = "";
			var cardID;

			//Reset card data
			cardsData = {};
			firstCard.id = secondCard.id = null;
			firstCard.$card = secondCard.$card = null;
			firstCard.value = secondCard.value = null;

			checkGameData(gameData);
			gameDetails = gameData;
			cardsURL = options.URL + gameDetails.id + "/cards/";


			//FILL GAME BOARD WITH CARDS
			for(var y = 0; y < gameData.height; y++){

				cardsHTML += "<div class='row'>";
				
				for(var x = 0; x < gameData.width; x++){
					cardID = "card-" + x +"-" + y;
					cardsHTML += "<div class='card card--inplay' id='" + cardID + "'><div class='card__face card__face--front'></div><div class='card__face card__face--back'></div></div>";
					
					//Save the card's coordinates so they dont have to be recomputed later
					cardsData[cardID] = {coords:  {x: x, y: y}, value: null, matched: false, seen: false};
				}
				cardsHTML += "</div>";
			}

			cardsLeft = gameData.height * gameData.width;

			//Add cards to gameboard
			$("#wait").hide();
			$("#dialogbox").hide();
			$("#gameboard").html(cardsHTML);
			setGameboardSizes();
			allowGuess = true;
			solverActive = false;

			showMessage("Pick a card " + username);
			$("#solve-message").addClass("footer__title--show");
		}


		function setGameboardSizes(){

			var margin, marginsWidth, marginsHeight;
			var cardsWidth, cardWidth;
			var cardsHeight, cardHeight;

			$("#gameboard").addClass("gameboard--fullheight");

			marginsWidth = options.cardMargin * (gameDetails.width - 1);
			cardsWidth = $(".row").width() - marginsWidth;
			cardWidth = Math.floor( cardsWidth / gameDetails.width );
			cardWidth -= 2; //for border

			marginsHeight = margin * (gameDetails.height - 1);
			cardsHeight = $("#middle").height() - marginsWidth;
			cardHeight = Math.floor( cardsHeight / gameDetails.height );
			cardHeight -= 2;

			$(".card").each(function(){
				$(this)
					.width(cardWidth)
					.height(cardHeight)
					.find(".card__face--front").css("line-height", cardHeight+"px");
			});
				
		}


		function checkGameData(gameData){

			if (!gameData.id || isNaN(gameData.width) || isNaN(gameData.height)){
				console.log("error with game data");
				console.log(gameData);
			}
			else{
				console.log("game data okay");
			}
		}


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
				url: targetURL,
				type: "GET",
				success: function(data){
					showCard( $card, data);
				},
				error: cardAjaxError
			});
		}


		function cardAjaxError(jqXHR, status, error){
			console.log("something went wrong looking up the card: ", status, " ", error);
		}


		function showCard($card, value){

			saveForSolver($card, value);

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


		function checkPair(){
 
			//Mismatch
			if( firstCard.value !== secondCard.value){
				showMessage("Darn, no match. Try again.", animationDuration);
				setTimeout( hidePair, 1000);
			}

			//Match found
			else{
				showMessage("Woohoo!  Pair matched!", animationDuration);
				setTimeout( pairMatched, 1000);
			}
		}


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


		function pairMatched(){

			//Mark the cards as matched
			firstCard.$card
				.removeClass("card--inplay")
				//.find(".card__face--front")
				.addClass("card__face--matched");

			secondCard.$card
				.removeClass("card--inplay")
				//.find(".card__face--front")
				.addClass("card__face--matched");

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
 

		function endGame(){

			solverActive = false;

			//Get last pair
			var lastCards = $("#gameboard .card--inplay");

			console.log("lastcards: ", lastCards);

			if( lastCards.length !== 2 ){
				console.log("error ending game. there are not exactly two cards left");
				return;
			}

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
			console.log("error ending game: ", status, " ", error);
		}


		//FINISH GAME AUTOMATICALLY
		function solveGame(){

			if( cardsLeft > 2){

				solverActive = true;

				$("#solve-message").removeClass("footer__title--show");

				//Prep handlers for saving card data and picking next cards
				$("#gameboard").on("gameready", pickNextCard);

				//Go head and pick first card
				$("#"+pickCard()).click();
			}
		}

		
		//SAVE CARDS TO SOLVER MEMORY
		function saveForSolver($card, value){
			
			var cardID = $card.attr("id");
			cardsData[cardID].seen = true;

			//Haven't seen this letter before, just save to memory
			if( !solverMemory[value] ){
				solverMemory[value] = cardID;
			}

			//Have seen this letter before, add it to our list of known matches
			else{
				solverMatchesList.push( cardID );
			}
		}


		//AUTO-SOLVER PICK NEXT CARD
		function pickNextCard(){

			var match;

			//Stop when only 2 cards left
			console.log("cardsLeft ", cardsLeft);

			if(cardsLeft <= 2){
				$("#gameboard").off("gameready", pickNextCard);
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

			//If a match is known, pick one of those
			if( solverMatchesList.length > 0){
				cardID = solverMatchesList.pop();
			}
			
			//Otherwise pick a random card...
			else{
				//generate random series of cards to pick
				if (!solverQueue || solverQueue.length === 0){
					generateSolverQueue();
				}

				//Pop next unseen card
				do{
					cardID = solverQueue.pop();
				} while( cardsData[cardID].seen == true );
			}

			console.log("card picked: ", cardID);
			return cardID;
		}


		// GENERATES A RANDOMISED LIST OF CARDS FOR USE BY AUTO-SOLVER ROUTINE
		function generateSolverQueue(){

			var numCards = gameDetails.width * gameDetails.height;
			var x;
			var y;
			var cardID;
			var pos;

			//Create array for randomised list
			solverQueue = new Array(numCards);

			//Assign every card ID into randomised list
			for(y = 0; y < gameDetails.height; y++){
				for(x = 0; x < gameDetails.width; x++){

					cardID = "card-" + x +"-" + y;
					
					//Get random position
					do{
						pos = Math.floor(Math.random() * numCards);
					} while ( solverQueue[pos] !== undefined);

					solverQueue[pos] = cardID;
				}
			}
		}


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


	return new TotalRecallGame();
});