'use strict';

var MTG = angular.module("MTG", []);

var MTG_App = angular.module("MTG_App", ["MTG"]);

MTG.controller("MTG_Ctrl", ["$scope",
	function($scope) {

		var players = $scope.players = [];
		$scope.sortedPlayers = [];
		$scope.roundCount = 0;

		$scope.selectedRound = 0;
		$scope.playerNameToAdd = "";

		$scope.roundCountRange = function()
		{
			return new Array($scope.roundCount).fill(1).map((v, i) => i);
		}

		function lowerPowerOfTwo(x)
		{
			var i = 0;
			var lastRes = 1;
			var res = 1;
			while (res < x)
			{
				i++;
				lastRes = res;
				res *= 2;
			}
			return i;
		}

		$scope.computeNbRounds = function()
		{
			return lowerPowerOfTwo(players.length);
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
				return (Math.random() > 0.5 ? 1 : -1);
			});
		}
		
		window.findBye = function findBye()
		{
			var res = $scope.sortedPlayers.reduceRight((acc, player) => {
				var playerByeCount = $scope.computeByeCount(player);
				var playerMatchPoints = $scope.computePlayerMatchPoints(player);
				if (playerByeCount < acc.minByeCount)
				{
					acc.minByeCount = playerByeCount;
					acc.minMatchPoints = playerMatchPoints;
					acc.playersTiedToBye.length = 0;
				}
				if ((playerByeCount == acc.minByeCount) && (playerMatchPoints == acc.minMatchPoints))
				{
					acc.playersTiedToBye.push(player);
				}
				return acc;
			}, {
				minByeCount: +Infinity,
				minMatchPoints: +Infinity,
				playersTiedToBye: []
			});

			return res.playersTiedToBye[Math.floor(Math.random() * res.playersTiedToBye.length)];
		}
	
		function createPlayer(playerName)
		{
			return {
				"name": playerName,
				"matches": []
			};
		}

		function searchForAPlayer(playerName)
		{
			var player = null;
			for (var i = 0; i < players.length; i++)
			{
				var p = players[i];
				if (p.name == playerName)
				{
					player = p;
				}
			}
			return player;
		}

		$scope.computeMatchesWin = function(player)
		{
			return player.matches.reduce((pv, cv) => {
				if (cv.finished && (cv.myGames > cv.opponentGames))
				{
					pv += 1;
				}
				return pv;
			}, 0);
		}

		$scope.computeMatchesLoose = function(player)
		{
			return player.matches.reduce((pv, cv) => {
				if (cv.finished && (cv.myGames < cv.opponentGames))
				{
					pv += 1;
				}
				return pv;
			}, 0);
		}

		$scope.computeMatchesDraw = function(player)
		{
			return player.matches.reduce((pv, cv) => {
				if (cv.finished && (cv.myGames == cv.opponentGames))
				{
					pv += 1;
				}
				return pv;
			}, 0);
		}

		$scope.computeByeCount = function(player)
		{
			return player.matches.reduce((pv, cv) => {
				if (cv.bye)
				{
					pv += 1;
				}
				return pv;
			}, 0);
		}

		$scope.computePlayerMatchPoints = function(player)
		{
			return player.matches.reduce((pv, cv) => {
				if (cv.bye || (cv.finished && (cv.myGames > cv.opponentGames)))
				{
					pv += 3;
				}
				else if (cv.finished && (cv.myGames == cv.opponentGames))
				{
					pv += 1;
				}
				return pv;
			}, 0);
		}

		$scope.computePlayerMatchWinPercent = function(player)
		{
			var matchPoints = $scope.computePlayerMatchPoints(player);

			var roundsPlayed = player.matches.reduce((pv, cv) => {
				if (cv.bye || cv.finished)
				{
					pv += 1;
				}
				return pv;
			}, 0);

			var res = (matchPoints / (3 * roundsPlayed));

			if (isNaN(res) || (res < 1 / 3))
			{
				res = (1 / 3);
			}

			return res.toFixed(4);
		}

		$scope.computeOpponentMatchWinPercent = function(player)
		{
			var opponentCount = 0;

			var res = player.matches.reduce((pv, cv) => {
				if (!cv.bye)
				{
					var opponent = searchForAPlayer(cv.opponent);
					if (opponent)
					{
						pv += $scope.computePlayerMatchWinPercent(opponent);
						opponentCount++;
					}
				}
				return pv;
			}, 0);

			res /= opponentCount;

			if (isNaN(res) || (res < 1 / 3))
			{
				res = (1 / 3);
			}

			return res.toFixed(4);
		}

		$scope.computePlayerGamePoints = function(player)
		{
			var res = player.matches.reduce((pv, cv) => {
				if (cv.finished)
				{
					pv += (3 * cv.myGames);
				}
				else if (cv.bye)
				{
					pv += (3 * 2);
				}
				return pv;
			}, 0);

			return res;
		}

		$scope.computePlayerGameWinPercent = function(player)
		{
			var gamePoints = $scope.computePlayerGamePoints(player);

			var gamesPlayed = player.matches.reduce((pv, cv) => {
				if (cv.finished)
				{
					pv += (cv.myGames + cv.opponentGames);
				}
				else if (cv.bye)
				{
					pv += 2;
				}
				return pv;
			}, 0);

			var res = (gamePoints / (3 * gamesPlayed));

			if (isNaN(res) || (res < 1 / 3))
			{
				res = (1 / 3);
			}

			return res.toFixed(4);
		}

		$scope.computeOpponentGameWinPercent = function(player)
		{
			var opponentCount = 0;

			var res = player.matches.reduce((pv, cv) => {
				if (!cv.bye)
				{
					var opponent = searchForAPlayer(cv.opponent);
					if (opponent)
					{
						pv += $scope.computePlayerGameWinPercent(opponent);
						opponentCount++;
					}
				}
				return pv;
			}, 0);

			res /= opponentCount;

			if (isNaN(res) || (res < 1 / 3))
			{
				res = (1 / 3);
			}

			return res.toFixed(4);
		}

		function createMatch(opponentName, isBye)
		{
			return {
				"opponent": opponentName,
				"bye": isBye,
				"finished": false,
				"myGames": 0,
				"opponentGames": 0
			};
		}

		$scope.newRound = function()
		{
			if (players.length < 2)
			{
				return;
			}

			if ($scope.roundCount >= $scope.computeNbRounds())
			{
				return;
			}

			console.log("New round", $scope.roundCount);

			sortPlayers();

			if ($scope.sortedPlayers.length % 2)
			{
				var byePlayer = findBye();

				byePlayer.matches[$scope.roundCount] = createMatch("", true, 0, 0);

				console.log("bye", byePlayer.name);
			}

			for (var i = 0; i < $scope.sortedPlayers.length; i++)
			{
				var p = $scope.sortedPlayers[i];
				console.log("p", p);
				if (p.matches[$scope.roundCount])
				{
					console.log("has already a match");
					continue;
				}
				var o = null;
				var found = false;
				for (var j = i + 1; j < $scope.sortedPlayers.length; j++)
				{
					o = $scope.sortedPlayers[j];
					console.log("o", o);
					if (o.matches[$scope.roundCount] || checkForAlreadyPlayedGames(p, o))
					{
						if (o.matches[$scope.roundCount])
						{
							console.log("has already a match");
						}
						else if (checkForAlreadyPlayedGames(p, o))
						{
							console.log("already played against this opponent");
						}
						continue;
					}
					p.matches[$scope.roundCount] = createMatch(o.name, false);
					o.matches[$scope.roundCount] = createMatch(p.name, false);
					found = true;
					break;
				}

				if (!found)
				{
					throw "Opponent not found";
				}

				console.log(p.name, "vs", o.name);
			}

			$scope.selectedRound = $scope.roundCount;
			$scope.roundCount++;

			save();
		}

		$scope.cancelLastRound = function()
		{
			if (!confirm("You will CANCEL THE LAST ROUND matches. Are you sure?"))
			{
				return;
			}

			if ($scope.roundCount <= 0)
			{
				return;
			}

			$scope.roundCount--;
			$scope.selectedRound = $scope.roundCount;

			for (var i = 0; i < players.length; i++)
			{
				var p = players[i];
				delete p.matches.splice($scope.roundCount, 1);
			}

			sortPlayers();

			save();
		}

		function checkForAlreadyPlayedGames(p1, p2)
		{
			for (var i = 0; i < p1.matches.length; i++)
			{
				var m = p1.matches[i];
				if (m.opponent == p2.name)
				{
					return true;
				}
			}
			return false;
		}

		$scope.updateScore = function(match)
		{
			var opponent = searchForAPlayer(match.opponent);
			if (opponent)
			{
				opponent.matches[$scope.selectedRound].myGames = match.opponentGames;
				opponent.matches[$scope.selectedRound].opponentGames = match.myGames;
				opponent.matches[$scope.selectedRound].finished = match.finished;
			}

			save();
		}

		$scope.reset = function()
		{
			if (!confirm("You will RESET ALL DATA. Are you sure?"))
			{
				return;
			}

			$scope.roundCount = 0;
			players = [];
			save();
			load();
		}

		$scope.addPlayer = function()
		{
			var playerName = $scope.playerNameToAdd;

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

			console.log(players);
		}

		function saveCookie(name, data)
		{
			var days = 1;
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
			var idxstart = cookie.indexOf("=", idx+1);
			if (idxstart == -1)
			{
				return null;
			}
			var idxend = cookie.indexOf(";", idxstart+1);
			if (idxend == -1)
			{
				idxend = cookie.length;
			}
			idxend -= 1;
			var data = cookie.substr(idxstart+1, idxend - idxstart);
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
			saveData("players", players);
			saveData("roundCount", $scope.roundCount);
			sortPlayers();
		}

		function load()
		{
			var playersT = loadData("players");
			if (playersT)
			{
				players = $scope.players = playersT;
				sortPlayers();
			}

			console.log(players);

			var roundCountT = loadData("roundCount");
			if (roundCountT)
			{
				$scope.roundCount = roundCountT;
				$scope.selectedRound = $scope.roundCount - 1;
			}
		}

		load();
	}
]);
