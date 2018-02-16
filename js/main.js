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
			return new Array($scope.roundMaxCount()).fill(1).map((v, i) => (i + 1));
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
				return (hash(p1) - hash(p2));
			});
		}

		function playerMatches(playerName)
		{
			var filteredRounds = rounds.map(matches => matches.filter(match => (match.playerName == playerName || match.opponentName == playerName)))
			if (filteredRounds.length == 0)
			{
				filteredRounds = [[]];
			}
			var matches = Array.concat.apply([], filteredRounds);
			return matches;
		}

		function matchAlreadyPlayed(p1, p2)
		{
			var filteredRounds = rounds.map(matches => matches.filter((m) => ((m.playerName == p1.name && m.opponentName == p2.name) || (m.playerName == p2.name && m.opponentName == p1.name))));
			if (filteredRounds.length == 0)
			{
				filteredRounds = [[]];
			}
			var matches = Array.concat.apply([], filteredRounds);
			return (matches.length > 0);
		}

		function hash(player)
		{
			var str = player.name;
			var pMatches = playerMatches(player.name);
			for (var i = 0; i < pMatches.length; i++)
			{
				var m = pMatches[i];
				if (m.bye || m.finished)
				{
					str += ("_" + m.playerName + m.playerScore + m.opponentScore + m.opponentName);
				}
			}
			return hashCode(str);
		}

		function hashCode(str)
		{
			var hash = 0;
			for (var i = 0; i < str.length; i++)
			{
				var char = str.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash; // Convert to 32bit integer
			}
			//console.log("hashCode", str, hash);
			return hash;
		}
		
		function createPlayer(playerName)
		{
			return {
				"name": playerName
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
			return playerMatches(player.name).reduce((acc, match) => {
				if (match.finished)
				{
					if ((match.playerName == player.name && match.playerScore > match.opponentScore)
					|| (match.opponentName == player.name && match.opponentScore > match.playerScore))
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
			return playerMatches(player.name).reduce((acc, match) => {
				if (match.bye)
				{
					acc += 3;
				}
				else if (match.finished)
				{
					if ((match.playerName == player.name && match.playerScore > match.opponentScore)
					|| (match.opponentName == player.name && match.playerScore < match.opponentScore))
					{
						acc += 3;
					}
					else if (match.playerScore == match.opponentScore)
					{
						acc += 1;
					}
				}
				return acc;
			}, 0);
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
			var opponentCount = 0;

			var acc = playerMatches(player.name).reduce((acc, match) => {
				if (!match.bye)
				{
					var opponent = searchForAPlayer(match.opponentName);
					if (opponent)
					{
						acc += $scope.computePlayerMatchWinPercent(opponent);
						opponentCount++;
					}
				}
				return acc;
			}, 0);

			var res = 0;

			if (opponentCount > 0)
			{
				acc /= opponentCount;
			}

			if (isNaN(res) || (res < 1 / 3))
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
					acc += (3 * match.playerScore);
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
			var opponentCount = 0;

			var acc = playerMatches(player.name).reduce((acc, match) => {
				if (!match.bye)
				{
					var opponent = searchForAPlayer(match.opponentName);
					if (opponent)
					{
						acc += $scope.computePlayerGameWinPercent(opponent);
						opponentCount++;
					}
				}
				return acc;
			}, 0);

			var res = 0;

			if (opponentCount > 0)
			{
				acc /= opponentCount;
			}

			if (res < 1 / 3)
			{
				res = (1 / 3);
			}

			return res;
		}

		function createMatch(playerName, opponentName, isBye)
		{
			return {
				"playerName": playerName,
				"opponentName": opponentName,
				"bye": isBye,
				"finished": false,
				"playerScore": 0,
				"opponentScore": 0
			};
		}

		function findBye(players)
		{
			var res = players.reduceRight(function(acc, player) {
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

			var byePlayer = res.playersTiedToBye[Math.floor(Math.random() * res.playersTiedToBye.length)];

			var idx = players.indexOf(byePlayer);

			if (idx != -1)
			{
				players.splice(idx, 1);
			}

			return byePlayer;
		}

		$scope.lastRoundScoresEntered = function()
		{
			var lastRound = roundCount() - 1;

			if (lastRound >= 0)
			{
				var pendingMatchs = rounds[lastRound].filter(match => (!match.bye && !match.finished));

				if (pendingMatchs.length > 0)
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

			console.log("New round", round);

			sortPlayers();

			var playersToPair = $scope.sortedPlayers.slice();

			var byePlayer = null;

			if (playersToPair.length % 2)
			{
				byePlayer = findBye(playersToPair);
				console.log("Bye:", byePlayer.name);
			}

			var pickRandom = true;//(round < $scope.roundMaxCount() - 1);

			console.log("pickRandom", pickRandom);

			var matchesToAdd = [];

			while (playersToPair.length)
			{
				var player = playersToPair.shift();
				console.log("player", player);
				
				var o = null;
				var possibilities = [];
				var pmp = $scope.computePlayerMatchPoints(player);
				var cmp = pmp;
				for (var j = 0; j < playersToPair.length; j++)
				{
					o = playersToPair[j];
					var omp = $scope.computePlayerMatchPoints(o);

					if (possibilities == 0)
					{
						cmp = omp;
					}

					if (cmp == omp)
					{
						if (!matchAlreadyPlayed(player, o))
						{
							possibilities.push(o);
							if (!pickRandom)
							{
								break;
							}
						}
						continue;
					}
					else
					{
						break;
					}
				}

				if (possibilities.length == 0)
				{
					alert("A paired match has already been played. Trying to switch a player of an already paired match...");

					var mm = matchesToAdd.filter(m => {
						var p1 = searchForAPlayer(m.playerName);
						var p1mp = $scope.computePlayerMatchPoints(p1);
						var p2 = searchForAPlayer(m.opponentName);
						var p2mp = $scope.computePlayerMatchPoints(p2);
						if (p1mp <= pmp && p2mp <= pmp)
						{
							return true;
						}
						return false;
					});
					console.log("available matches to change", mm);
					var replaced = false;
					for (var k = 0; k < mm.length; k++)
					{
						var mmk = mm[k];

						// We start to trying to replace the opponent because he may have a lesser match points than the player
						if (!matchAlreadyPlayed(player, mmk.playerName))
						{
							console.log("Match changed:", mmk.playerName, "vs", mmk.opponentName, "; to:", mmk.playerName, "vs", player.name);
							console.log("Replacing " + mmk.opponentName + " in players to pair list");
							playersToPair.unshift(searchForAPlayer(mmk.opponentName));
							mmk.opponentName = player.name;
							replaced = true;
							break;
						}
						else if (!matchAlreadyPlayed(player, mmk.opponentName))
						{
							console.log("Match changed:", mmk.playerName, "vs", mmk.opponentName, "; to:", player.name, "vs", mmk.opponentName);
							console.log("Replacing " + mmk.playerName + " in players to pair list");
							playersToPair.unshift(searchForAPlayer(mmk.playerName));
							mmk.playerName = player.name;
							replaced = true;
							break;
						}
						else
						{
							continue;
						}
					}

					if (replaced)
					{
						alert("We succeed to switch a player of an already paired match to avoid an already played match.");
						continue;
					}
					else
					{
						if (playersToPair.length > 0)						
						{
							alert("We failed to switch a player of an already paired match, so we paired an already played match!");
							possibilities.push(playersToPair[0]);
						}
						else
						{
							alert("Unknow error. The round has been canceled.");
							return;
						}
					}
				}

				console.log("possibilities", possibilities);

				var opponent = possibilities[Math.floor(Math.random() * possibilities.length)];
				matchesToAdd.push(createMatch(player.name, opponent.name, false));
				var idx = playersToPair.indexOf(opponent);
				if (idx != -1)
				{
					playersToPair.splice(idx, 1);
				}

				console.log("Match:", player.name, "vs", opponent.name);
			}

			if (byePlayer)
			{
				matchesToAdd.push(createMatch(byePlayer.name, "", true));
			}

			console.log(matchesToAdd);

			rounds[round] = matchesToAdd;

			$scope.selectedRound = round;

			save();
		}

		$scope.cancelLastRound = function()
		{
			//if (!confirm("You will CANCEL THE LAST ROUND matches. Are you sure?"))
			{
				//return;
			}

			if (roundCount() <= 0)
			{
				return;
			}

			delete rounds.splice(roundCount() - 1, 1);

			sortPlayers();

			$scope.selectedRound = roundCount() - 1;

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
			console.log("save");

			saveData("players", players);
			saveData("rounds", rounds);
			saveData("selectedRound", $scope.selectedRound);

			sortPlayers();
		}

		function load()
		{
			console.log("load");

			var playersT = loadData("players");
			if (playersT)
			{
				players = $scope.players = playersT;
			}

			console.log("Players", players);

			var matchesT = loadData("rounds");
			if (matchesT)
			{
				rounds = $scope.rounds = matchesT;
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
