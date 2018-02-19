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
			var filteredRounds = rounds.map(round => round.filter(match => (match.playerName == playerName || match.opponentName == playerName)));
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
/*
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
*/
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

			for (var i = 0; i < players.length; i++)
			{
				var player = players[i];
				do
				{
					player.tb4 = Math.floor(1000000 * Math.random());
				}
				while (players.some(p => ((p.name != player.name) && (p.tb4 == player.tb4))));
			}

			sortPlayers();

			var playersToPair = $scope.sortedPlayers.slice();

			var byePlayer = null;

			var pickRandom = true;//(round < $scope.roundMaxCount() - 1);

			console.log("pickRandom", pickRandom);

			var matchesToAdd = [];

			while (playersToPair.length)
			{
				var player = playersToPair.shift();
				console.log("player", player);

				if (playersToPair.length == 0)
				{
					byePlayer = player;
					break;
				}
				
				var o = null;
				var possibilities = [];
				var pmp = $scope.computePlayerMatchPoints(player);
				var cmp = pmp;
				for (var j = 0; j < playersToPair.length; j++)
				{
					o = playersToPair[j];
					var omp = $scope.computePlayerMatchPoints(o);

					if (possibilities.length == 0)
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
				matchesToAdd.push(createMatch(false, player.name, opponent.name));
				var idx = playersToPair.indexOf(opponent);
				if (idx != -1)
				{
					playersToPair.splice(idx, 1);
				}

				console.log("Match:", player.name, "vs", opponent.name);
			}

			if (byePlayer)
			{
				console.log("Bye:", byePlayer.name);
				matchesToAdd.push(createMatch(true, byePlayer.name));
			}

			console.log(matchesToAdd);

			rounds[round] = matchesToAdd;

			$scope.selectedRound = round;

			console.log(players);

			save();
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

			console.log("players", players);
			console.log("rounds", rounds);
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
