'use strict';

var MTG = angular.module("MTG", []);

var MTG_App = angular.module("MTG_App", ["MTG"]);

MTG.controller("MTG_Ctrl", ["$scope",
	function($scope) {

		var players = $scope.players = [];
		var rounds = $scope.rounds = [];

		$scope.sortedPlayers = [];
		$scope.selectedRound = 0;
		$scope.playerNameToAdd = "";

		$scope.canAddPlayer = function(playerName)
		{
			if (playerName.length == 0)
			{
				return false;
			}
			return players.every(p => (p.name != playerName));
		}

		$scope.selectRound = function(round)
		{
			$scope.selectedRound = round;
			save();
		}

		var roundCount = $scope.roundCount = function()
		{
			return rounds.length;
		}

		$scope.roundMaxCount = function()
		{
			return lowerPowerOfTwo(players.length);
		}

		$scope.roundMaxCountRange = function()
		{
			return new Array($scope.roundMaxCount()).fill(0).map((v, i) => (i + 1));
		}

		function lowerPowerOfTwo(x)
		{
			var i = 0;
			var res = 1;
			while (res < x)
			{
				i++;
				res *= 2;
			}
			return i;
		}

		function sortPlayers()
		{
			$scope.sortedPlayers = players.slice().sort((p1, p2) => {
				// Match points
				var PMP1 = $scope.computePlayerMatchPoints(p1);
				var PMP2 = $scope.computePlayerMatchPoints(p2);
				if (PMP1 != PMP2)
				{
					return (PMP2 - PMP1);
				}

				// Tie breaker 1
				var OMWP1 = $scope.computeOpponentMatchWinPercent(p1);
				var OMWP2 = $scope.computeOpponentMatchWinPercent(p2);
				if (OMWP1 != OMWP2)
				{
					return (OMWP2 - OMWP1);
				}

				// Tie breaker 2
				var PGWP1 = $scope.computePlayerGameWinPercent(p1);
				var PGWP2 = $scope.computePlayerGameWinPercent(p2);
				if (PGWP1 != PGWP2)
				{
					return (PGWP2 - PGWP1);
				}

				// Tie breaker 3
				var OGWP1 = $scope.computeOpponentGameWinPercent(p1);
				var OGWP2 = $scope.computeOpponentGameWinPercent(p2);
				if (OGWP1 != OGWP2)
				{
					return (OGWP2 - OGWP1);
				}

				// Tie breaker 4
				if (p1.tb4 != p2.tb4)
				{
					return (p2.tb4 - p1.tb4);
				}

				// Asc name sort
				if (p1.name != p2.name)
				{
					return (p1.name.localeCompare(p2.name));
				}

				// random sort
				return (Math.random() < 0.5 ? -1 : 1);
			});
		}

		function playerMatches(playerName)
		{
			var filteredRounds = rounds.map((round, index) => {
				if (index <= $scope.selectedRound)
				{
					return round.filter(match => (match.playerName == playerName || match.opponentName == playerName));
				}
				else
				{
					return [];
				}
			});
			return Array.prototype.concat.apply([], filteredRounds);
		}

		function matchAlreadyPlayed(p1, p2)
		{
			return rounds.some(round => round.some(match => ((match.playerName == p1.name && match.opponentName == p2.name) || (match.playerName == p2.name && match.opponentName == p1.name))));
		}

		function createPlayer(playerName, tb4)
		{
			return {
				"name": playerName,
				"tb4": (tb4 || 0)
			};
		}

		function searchForAPlayer(playerName)
		{
			return players.find(player => (player.name == playerName));
		}

		$scope.computeMatchesWin = function(player)
		{
			return playerMatches(player.name).reduce((acc, match) => {
				if (match.finished)
				{
					if ((match.playerName == player.name && match.playerScore > match.opponentScore)
					|| (match.opponentName == player.name && match.playerScore < match.opponentScore))
					{
						acc += 1;
					}
				}
				return acc;
			}, 0);
		}

		$scope.computeByeCount = function(player)
		{
			return playerMatches(player.name).reduce((acc, match) => {
				if (match.bye)
				{
					acc += 1;
				}
				return acc;
			}, 0);
		}

		$scope.computeMatchesLoose = function(player)
		{
			return playerMatches(player.name).reduce((acc, match) => {
				if (match.finished)
				{
					if ((match.playerName == player.name && match.playerScore < match.opponentScore)
					|| (match.opponentName == player.name && match.playerScore > match.opponentScore))
					{
						acc += 1;
					}
				}
				return acc;
			}, 0);
		}

		$scope.computeMatchesDraw = function(player)
		{
			return playerMatches(player.name).reduce((acc, match) => {
				if (match.finished && (match.playerScore == match.opponentScore))
				{
					acc += 1;
				}
				return acc;
			}, 0);
		}

		$scope.computePlayerMatchPoints = function(player)
		{
			var winCount = $scope.computeMatchesWin(player);
			var byeCount = $scope.computeByeCount(player);
			var drawCount = $scope.computeMatchesDraw(player);
			return (3 * (winCount + byeCount) + drawCount);
		}

		$scope.computePlayerMatchWinPercent = function(player)
		{
			var matchPoints = $scope.computePlayerMatchPoints(player);

			var roundsPlayed = playerMatches(player.name).reduce((acc, match) => {
				if (match.bye || match.finished)
				{
					acc += 1;
				}
				return acc;
			}, 0);

			var res = 0;

			if (roundsPlayed > 0)
			{
				res = (matchPoints / (3 * roundsPlayed));
			}

			if (res < 1 / 3)
			{
				res = (1 / 3);
			}

			return res;
		}

		$scope.computeOpponentMatchWinPercent = function(player)
		{
			var matches = playerMatches(player.name);

			var acc = 0;
			var opponentCount = 0;

			for (var i = 0; i < matches.length; i++)
			{
				var match = matches[i];
				if (!match.bye && match.finished)
				{
					var opponentName = (match.playerName == player.name ? match.opponentName : match.playerName);
					var opponent = searchForAPlayer(opponentName);
					if (opponent)
					{
						acc += $scope.computePlayerMatchWinPercent(opponent);
						opponentCount++;
					}
				}
			}

			var res = 0;

			if (opponentCount > 0)
			{
				res = acc / opponentCount;
			}

			if (res < 1 / 3)
			{
				res = (1 / 3);
			}

			return res;
		}

		$scope.computePlayerGamePoints = function(player)
		{
			var res = playerMatches(player.name).reduce((acc, match) => {
				if (match.finished)
				{
					var playerScore = (match.playerName == player.name ? match.playerScore : match.opponentScore);
					acc += (3 * playerScore);
				}
				else if (match.bye)
				{
					acc += (3 * 2);
				}
				return acc;
			}, 0);

			return res;
		}

		$scope.computePlayerGameWinPercent = function(player)
		{
			var gamePoints = $scope.computePlayerGamePoints(player);

			var gamesPlayed = playerMatches(player.name).reduce((acc, match) => {
				if (match.finished)
				{
					acc += (match.playerScore + match.opponentScore);
				}
				else if (match.bye)
				{
					acc += 2;
				}
				return acc;
			}, 0);

			var res = 0;

			if (gamesPlayed > 0)
			{
				res = (gamePoints / (3 * gamesPlayed));
			}

			if (res < 1 / 3)
			{
				res = (1 / 3);
			}

			return res;
		}

		$scope.computeOpponentGameWinPercent = function(player)
		{
			var matches = playerMatches(player.name);

			var acc = 0;
			var opponentCount = 0;
			
			for (var i = 0; i < matches.length; i++)
			{
				var match = matches[i];
				if (!match.bye && match.finished)
				{
					var opponentName = (match.playerName == player.name ? match.opponentName : match.playerName);
					var opponent = searchForAPlayer(opponentName);
					if (opponent)
					{
						acc += $scope.computePlayerGameWinPercent(opponent);
						opponentCount++;
					}
				}
			}

			var res = 0;

			if (opponentCount > 0)
			{
				res = acc / opponentCount;
			}

			if (res < 1 / 3)
			{
				res = (1 / 3);
			}

			return res;
		}

		function createMatch(isBye, playerName, opponentName, playerScore, opponentScore, isFinished)
		{
			return {
				"bye": (isBye || false),
				"playerName": (playerName || ""),
				"opponentName": (opponentName || ""),
				"playerScore": (playerScore || 0),
				"opponentScore": (opponentScore || 0),
				"finished": (isFinished || false)
			};
		}

		$scope.lastRoundScoresEntered = function()
		{
			var lastRound = roundCount() - 1;

			if (lastRound >= 0)
			{
				var res = rounds[lastRound].reduce((acc, match) => {
					if ((!match.bye && !match.finished))
					{
						acc++;
					}
					return acc;
				}, 0);

				if (res > 0)
				{
					return false;
				}
			}
			return true;
		}

		$scope.canCreateNewRound = function()
		{
			if (roundCount() < $scope.roundMaxCount())
			{
				return true;
			}

			return false;
		}

		$scope.canCancelLastRound = function()
		{
			if (roundCount() > 0)
			{
				return true;
			}

			return false;
		}

		function takeUnplayedOpponents(player, playersToPair)
		{
			return playersToPair.filter(opponent => (player != opponent && !matchAlreadyPlayed(player, opponent)));
		}

		function tryToPairPlayers(playersToPair, random)
		{
			// If no players left to pair
			if (playersToPair.length == 0)
			{
				// Return empty list of matches
				return [];
			}

			// Take first player from playersToPair, remove player from playersToPair
			var player = playersToPair.shift();

			// Check the bye (last player)
			if (playersToPair.length == 0)
			{
				// Compute player bye count
				var playerByeCount = $scope.computeByeCount(player);

				// Check if there is another player who should have the bye
				var canBye = players.every(p => ($scope.computeByeCount(p) >= playerByeCount));
				if (canBye)
				{
					// The bye is valid
					var byeMatch = createMatch(true, player.name);

					// Return success
					return [byeMatch];
				}
				else
				{
					// Return fail (another player should have the bye)
					return false;
				}
			}

			// Get available opponents (unplayed)
			var availableOpponents = takeUnplayedOpponents(player, playersToPair);

			if (random)
			{
				// Randomize opponents by grouping player match points
				availableOpponents.sort((p1, p2) => {
					// Match points
					var PMP1 = $scope.computePlayerMatchPoints(p1);
					var PMP2 = $scope.computePlayerMatchPoints(p2);
					if (PMP1 != PMP2)
					{
						return (PMP2 - PMP1);
					}

					// Tie breaker 4
					if (p1.tb4 != p2.tb4)
					{
						return (p2.tb4 - p1.tb4);
					}
				});
			}

			// Parse opponents
			var o = 0;
			do
			{
				// Take opponent[o]
				var opponent = playersToPair[o];

				// Copy playersToPair
				var newPlayersToPair = playersToPair.slice();

				// Remove opponent from playersToPair copy
				newPlayersToPair.splice(o, 1);

				// recursive call for trying to pair remaining players, get matches as result
				var matches = tryToPairPlayers(newPlayersToPair, random);
				if (matches)
				{
					// We succeed to pair the remaining players, create the match
					var match = createMatch(false, player.name, opponent.name);

					// Add match to matches
					matches.unshift(match);

					// Return success
					return matches;
				}

				o++;
			} while(o < playersToPair.length);

			// Return fail (to find an opponent)
			return false;
		}
		
		$scope.newRound = function()
		{
			if (players.length < 2)
			{
				return;
			}

			var round = roundCount();

			if (round >= $scope.roundMaxCount())
			{
				return;
			}

			if (!$scope.lastRoundScoresEntered())
			{
				alert("Please enter all scores.");
				return;
			}

			console.log("New round", round + 1);

			generateTiebreaker4();
			sortPlayers();

			var playersToPair = $scope.sortedPlayers.slice();

			var matches = tryToPairPlayers(playersToPair, true);

			console.log("matches", matches);

			rounds[round] = matches;

			$scope.selectedRound = round;

			generateTiebreaker4();
			sortPlayers();

			save();
		}

		function generateTiebreaker4()
		{
			// Regenerate Tiebreaker 4
			for (var i = 0; i < players.length; i++)
			{
				var player = players[i];
				do
				{
					player.tb4 = Math.floor(1000000 * Math.random());
				}
				while (players.some(p => ((p.name != player.name) && (p.tb4 == player.tb4))));
			}
		}

		$scope.cancelLastRound = function()
		{
			if (!confirm("You will CANCEL THE LAST ROUND matches. Are you sure?"))
			{
				return;
			}

			if (roundCount() <= 0)
			{
				return;
			}

			delete rounds.pop();

			if (roundCount() == 0)
			{
				players.map(player => player.tb4 = 0);
			}

			sortPlayers();

			if ($scope.selectedRound >= roundCount())
			{
				$scope.selectedRound = Math.max(0, roundCount() - 1);
			}

			save();
		}

		$scope.updateScore = function(match)
		{
			save();
		}

		$scope.reset = function()
		{
			if (!confirm("You will RESET ALL DATA. Are you sure?"))
			{
				return;
			}

			players = [];
			rounds = [];
			$scope.selectedRound = 0;

			save();
			load();
		}

		$scope.addPlayerKeyPress = function($event, playerNameToAdd)
		{
			if ($event.which == 13)
			{
				$scope.addPlayer(playerNameToAdd);
			}
		}

		$scope.addPlayer = function(playerName)
		{
			if (playerName == "")
			{
				return;
			}

			if (searchForAPlayer(playerName))
			{
				alert("Player name already exists!");
				return;
			}

			$scope.playerNameToAdd = "";

			players.push(createPlayer(playerName));

			save();
		}

		function saveCookie(name, data)
		{
			var days = 30;
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
			document.cookie = (name + "=" + data + expires);
		}

		function loadCookie(name)
		{
			var cookie = decodeURIComponent(document.cookie);
			var idx = cookie.indexOf(name+"=");
			if (idx == -1)
			{
				return null;
			}
			var idxstart = idx + name.length;
			var idxend = cookie.indexOf(";", idxstart + 1);
			if (idxend == -1)
			{
				idxend = cookie.length;
			}
			idxend -= 1;
			var data = cookie.substr(idxstart + 1, idxend - idxstart);
			if (!data)
			{
				return null;
			}

			return data;
		}

		function saveData(name, data)
		{
			saveCookie(name, angular.toJson(data));
		}

		function loadData(name)
		{
			var data = loadCookie(name);
			if (!data)
			{
				return null;
			}
			return JSON.parse(data);
		}

		function save()
		{
			console.log("save");

			var players2 = players.map(p => [p.name, p.tb4]);
			var rounds2 = rounds.map(r => r.map(m => [m.bye, m.playerName, m.opponentName, m.playerScore, m.opponentScore, m.finished]))

			saveData("players", players2);
			saveData("rounds", rounds2);
			saveData("selectedRound", $scope.selectedRound);

			sortPlayers();
		}

		function load()
		{
			console.log("load");

			var playersT = loadData("players");
			if (playersT)
			{
				players = $scope.players = playersT.map(p => createPlayer(p[0], p[1]));
			}

			console.log("Players", players);

			var matchesT = loadData("rounds");
			if (matchesT)
			{
				rounds = $scope.rounds = matchesT.map(r => r.map(m => createMatch(m[0], m[1], m[2], m[3], m[4], m[5])));
			}

			console.log("Rounds", rounds);

			var selectedRoundT = loadData("selectedRound");
			if (selectedRoundT)
			{
				$scope.selectedRound = selectedRoundT;
			}

			sortPlayers();
		}

		load();
	}
]);
