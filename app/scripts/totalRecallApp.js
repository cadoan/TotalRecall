/*jshint -W109 */


define(['jquery'], function ($) {
	'use strict';



	//TOTAL RECALL GAME CLASS
	function TotalRecallGame(){

		var URL = "http://totalrecall.99cluster.com/games/";
		var gameDetails = {};
		var cardsURL;
		var cardsData = {};
		var allowGuess = true;
		var firstCard = { id: null, $card: null, value: null};
		var secondCard = { id: null, $card: null, value: null};
		var cardsLeft;

		var solverQueue;
		var solverMemory={};
		var solverMatchesList=[];


		// GAME SETUP
		this.init = function(){
			$("#signin").on("click", handleSignin);
			$("#gameboard").on("click", ".gameboard__row__card", cardClicked);
			$("#solve").on("click", solveGame);
		};



		//Get the game data via ajax call
		function handleSignin(event){
			event.preventDefault();

			//Show wait spinner
			$("#signin").hide();
			$("#wait").css("display", "inline-block");


			var signinDetails = $("#signinForm").serialize();
			$.ajax({
				url: URL,
				type: "POST",
				data: signinDetails,
				success: initGame,
				error: handleAjaxError
			});
		}



		function handleAjaxError(jqXHR, status, error){
			console.log("error: ", status, " ", error);
		}




		function initGame(gameData){
			
			checkGameData(gameData);

			gameDetails = gameData;
			cardsURL = URL + gameDetails.id + "/cards/";


			//FILL GAME BOARD WITH CARDS
			var cardsHTML = "";
			var cardID;
			for(var y = 0; y < gameData.height; y++){

				cardsHTML += "<div class='gameboard__row'>";
				
				for(var x = 0; x < gameData.width; x++){
					cardID = "card-" + x +"-" + y;
					cardsHTML += "<div class='gameboard__row__card gameboard__row__card--inplay' id='" + cardID + "'></div>";
					
					//Save the card's coordinates so they dont have to be recomputed later
					cardsData[cardID] = {coords:  {x: x, y: y}, value: null, matched: false, seen: false};
				}
				cardsHTML += "</div>";
			}

			cardsLeft = gameData.height * gameData.width;

			//Add to gameboard
			$("#intro-wrapper").hide();
			$("#gameboard").append(cardsHTML);
			$("#gameboard-wrapper").show();
		}




		function checkGameData(gameData){

			if (!gameData.id || isNaN(gameData.width) || isNaN(gameData.height))
				console.log("error with game data");
			else
				console.log("game data okay");
		}




		function cardClicked(event){

			//No clicks allowed if already handling a pair of cards 
			if(!allowGuess){
				console.log("game busy, guessing not allowed yet");
				return;
			}

			//Block further clicks while this card is handled
			allowGuess = false;

			var $card = $(event.target);

			//No clicks allowed on currently showing cards or matched cards
			if( $card.hasClass("gameboard__row__card--showing") || $card.hasClass("gameboard__row__card--matched")){
				console.log('card already showing or matched');
				return;
			}


			var theCardData = cardsData[ $card.attr("id") ];
			var targetURL = cardsURL + theCardData.coords.x + "," + theCardData.coords.y;


			// Use card's saved value if it exists
			// if( theCardData.value ){
			// 	showCard($card, theCardData.value);
			// }

			// else{
				$.ajax({
					url: targetURL,
					type: "GET",
					success: function(data){

						//Save the value first
						theCardData.value = data;
						theCardData.seen = true;
						//theCardData.$card = $card;

						showCard( $card, data);
					},
					error: cardAjaxError
				});
			// }
		}



		function cardAjaxError(jqXHR, status, error){
			console.log("something went wrong looking up the card: ", status, " ", error);
		}



		function showCard($card, value){

			//Show new card
			$card
				.text(value)
				.addClass("gameboard__row__card--showing");


			//Is first card of current pair of clicks
			if(!firstCard.id){
				firstCard.id = $card.attr("id");
				firstCard.$card = $card;
				firstCard.value = value;
				allowGuess = true;
				$("#gameboard").trigger("gameready");
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
				
				//Save card info for the auto-solver
				saveForSolver();

				setTimeout( hidePair, 0);
			}

			//Match found
			else{
				setTimeout( pairMatched, 0);
			}
		}
			


		function hidePair(){
			
			firstCard.$card
				//.text("")
				.removeClass("")
				.removeClass("gameboard__row__card--showing gameboard__row__card--border");

			secondCard.$card
				//.text("")
				.removeClass("gameboard__row__card--showing gameboard__row__card--border");


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
				.addClass("gameboard__row__card--matched")
				.removeClass("gameboard__row__card--inplay");

			secondCard.$card
				.addClass("gameboard__row__card--matched")
				.removeClass("gameboard__row__card--inplay");

			cardsData[firstCard.id].matched = cardsData[secondCard.id].matched = true;


			//reset pair
			firstCard.id = secondCard.id = null;
			firstCard.$card = secondCard.$card = null;
			firstCard.value = secondCard.value = null;

			cardsLeft -= 2;

			//More matches to be made
			if(cardsLeft > 2){
				allowGuess = true;
				$("#gameboard").trigger("gameready");
			}

			//All pairs identified, game over
			else{
				allowGuess = true;  //TEMP: REMOVE IN LIVE
				endGame();
			}
		}
 


		function endGame(){

			//Get last pair
			var lastCards = $("#gameboard .gameboard__row__card--inplay");
			var value;

			console.log("lastcards: ", lastCards);

			if( lastCards.length !== 2 ){
				console.log("error ending game. there are not exactly two cards left");
				return;
			}

			//Get value if known
			// value = cardsData[ lastCards[0].attr("id") ].value || cardsData[ lastCards[1].attr("id") ].value;

			// if (!value){

			// }

			// //Show the last pair
			// if( cardsData[].value ){
			// 	value = cardsData[].value
			// }

			// else if( cardsData[].value ){
			// 	value = car
			// }

			// showCard($card, value);
			// showCard()

			//lastCards[0].click();

			//lastCards[1].click();

			var cardData = cardsData[ $(lastCards[0]).attr("id") ];
			var coordsString = "x1=" + cardData.coords.x + "&y1=" + cardData.coords.y;

			cardData = cardsData[ $(lastCards[1]).attr("id") ];
			coordsString += "&x2=" + cardData.coords.x + "&y2=" + cardData.coords.y;
			

			$.ajax({
				url: URL + gameDetails.id + "/end",
				type: "POST",
				data: coordsString,
				success: endGameResult,
				error: endGameError
			});

		}


		function endGameResult(data){

			console.log("success: ", data.success);
			if (data.success){
				alert("you won!");
			}
			else{
				alert("boo you lost!");
			}
		}

		function endGameError(jqXHR, status, error){
			console.log("error ending game: ", status, " ", error);
		}




		//FINISH GAME AUTOMATICALLY
		function solveGame(){

			var x;
			var y;
			var cardID;


			if( cardsLeft > 2){

				//Prep handlers for saving card data and picking next cards
				$("#gameboard").on("gameready", pickNextCard);

				//Go head and pick first card
				$("#"+pickCard()).click();
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



		//AUTO-SOLVER PICK NEXT CARD
		function pickNextCard(){

			var match;
			var x;
			var y;
			var cardID;


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
			var x;
			var y;
			var cardID;
			var i = 0;

			//If a match is known, pick one of those
			if( solverMatchesList.length > 0){
				cardID = solverMatchesList.pop();
			}
			

			//Otherwise pick a random card...
			else{
				//generate random series of cards to pick
				if (!solverQueue){
					generateSolverQueue();
				}

				//pop next unseen card
				do{
					cardID = solverQueue.pop();
				} while( cardsData[cardID].seen === true );
			}


			$("#"+cardID).addClass("gameboard__row__card--border");
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
			for(var y = 0; y < gameDetails.height; y++){				
				for(var x = 0; x < gameDetails.width; x++){

					cardID = "card-" + x +"-" + y;
					
					//Get random position
					do{
						pos = Math.floor(Math.random() * numCards);
					} while ( solverQueue[pos] != undefined)

					solverQueue[pos] = cardID;
				}
			}

		}
	}


	return new TotalRecallGame();
});