import {Cookie} from './cookie.js'

export class SwissTournamentController
{
	constructor($scope, $route, $routeParams, $q)
	{
		$scope.ctrl = this;
		this.scope = $scope;
		this.route = $route;
		this.q = $q;

		this.players = [];
		this.rounds = [];
		this.selectedRound = 0;
		
		this.sortedPlayers = [];
		this.playerNameToAdd = "";
		this.selectedPlayer = null;

		this.load();
		this.sortPlayers();

		if ($routeParams["import"])
		{
			this.route.updateParams({
				"import": ""
			});
			this.import();
		}
	}

    createPlayer(playerName, tb4, drop)
    {
        return {
            "name": playerName,
			"tb4": (tb4 || 0),
			"drop": drop
        };
    }

    createMatch(isBye, playerName, opponentName, playerScore, opponentScore, isFinished)
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
	
	playerDropped(playerName)
	{
		var player = this.getPlayerFromName(playerName);

		if (player == null)
		{
			throw new Exception("Can't find player");
		}

		return (player.drop === this.selectedRound || player.drop > this.selectedRound);
	}

	toggleDropPlayer(playerName, round)
	{
		console.log("dropPlayer", playerName, round);
		var player = this.getPlayerFromName(playerName);

		if (player == null)
		{
			throw new Exception("Can't find player");
		}

		if (player.drop !== round)
		{
			player.drop = round;
			this.save();
		}
		else
		{
			player.drop = false;
			this.save();
		}
	}

	toggleSelectPlayer(player)
	{
		if (this.roundCount() <= 0)
		{
			this.selectedPlayer = null;
			return;
		}

		if (player)
		{
			if (player != this.selectedPlayer)
			{
				this.selectedPlayer = player;
			}
			else
			{
				this.selectedPlayer = null;
			}
		}
	}

	canAddPlayer(playerName)
	{
		if (!playerName || playerName.length == 0)
		{
			return false;
		}
		return (this.getPlayerFromName(playerName) == null);
	}

	selectRound(round)
	{
		this.selectedRound = round;
		this.save();
		this.sortPlayers();
	}

	currentRound()
	{
		return this.roundCount() - 1;
	}

	roundCount()
	{
		return this.rounds.length;
	}

	roundMaxCount()
	{
		return this.lowerPowerOfTwo(this.players.length);
	}

	roundMaxCountRange()
	{
		return new Array(this.roundMaxCount()).fill(0).map((v, i) => (i + 1));
	}

	isCurrentRound()
	{
		return (this.selectedRound === (this.roundCount() - 1));
	}

	lowerPowerOfTwo(x)
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

	sortPlayers()
	{
		this.sortedPlayers = this.players.slice().sort((p1, p2) => {
			// Match points DESC
			var PMP1 = this.computePlayerMatchPoints(p1, this.selectedRound);
			var PMP2 = this.computePlayerMatchPoints(p2, this.selectedRound);
			if (PMP1 != PMP2)
			{
				return (PMP2 - PMP1);
			}

			// Tie breaker 1 DESC
			var OMWP1 = this.computeOpponentMatchWinPercent(p1, this.selectedRound);
			var OMWP2 = this.computeOpponentMatchWinPercent(p2, this.selectedRound);
			if (OMWP1 != OMWP2)
			{
				return (OMWP2 - OMWP1);
			}

			// Tie breaker 2 DESC
			var PGWP1 = this.computePlayerGameWinPercent(p1, this.selectedRound);
			var PGWP2 = this.computePlayerGameWinPercent(p2, this.selectedRound);
			if (PGWP1 != PGWP2)
			{
				return (PGWP2 - PGWP1);
			}

			// Tie breaker 3 DESC
			var OGWP1 = this.computeOpponentGameWinPercent(p1, this.selectedRound);
			var OGWP2 = this.computeOpponentGameWinPercent(p2, this.selectedRound);
			if (OGWP1 != OGWP2)
			{
				return (OGWP2 - OGWP1);
			}

			// Tie breaker 4 DESC
			if (p1.tb4 != p2.tb4)
			{
				return (p2.tb4 - p1.tb4);
			}

			// Asc name sort ASC
			if (p1.name != p2.name)
			{
				return (p1.name.localeCompare(p2.name));
			}

			// random sort DESC
			return (Math.random() > 0.5 ? 1 : -1);
		});
	}

	playerMatches(p1, p2, roundIndexMax)
	{
		if (!p1)
		{
			return [];
		}

		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var filteredRounds = this.rounds.map((round, index) => {
			if (index <= roundIndexMax)
			{
				return round.filter(match => (((match.playerName == p1.name && (!p2 || match.opponentName == p2.name)) || (match.opponentName == p1.name && (!p2 || match.playerName == p2.name)))));
			}
			return [];
		});
		return Array.prototype.concat.apply([], filteredRounds);
	}

	playerMatchesWinDiff(p1, p2, roundIndexMax)
	{
		if (!p1 || !p2)
		{
			return false;
		}

		var playerMatches = this.playerMatches(p1, p2, roundIndexMax);
		if (playerMatches.length == 0)
		{
			return false;
		}

		if (playerMatches.every(match => (!match.finished)))
		{
			return false;
		}

		var winDiff = playerMatches.reduce((acc, match) => {
			if ((match.playerName == p1.name && match.playerScore > match.opponentScore) || (match.opponentName == p1.name && match.opponentScore > match.playerScore))
			{
				acc++;
			}
			else if ((match.playerName == p2.name && match.playerScore > match.opponentScore) || (match.opponentName == p2.name && match.opponentScore > match.playerScore))
			{
				acc--;
			}
			return acc;
		}, 0);
		return winDiff;
	}

	matchAlreadyPlayed(p1, p2, roundIndexMax)
	{
		if (!p1 || !p2)
		{
			return 0;
		}
		
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(p1, p2, roundIndexMax).length;
	}

	getPlayerFromName(playerName)
	{
		return this.players.find(player => (player.name == playerName));
	}

	computeMatchesWin(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
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

	computeByeCount(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
			if (match.bye)
			{
				acc += 1;
			}
			return acc;
		}, 0);
	}

	computeMatchesLoose(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
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

	computeMatchesDraw(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
			if (match.finished && (match.playerScore == match.opponentScore))
			{
				acc += 1;
			}
			return acc;
		}, 0);
	}

	computePlayerMatchPoints(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var winCount = this.computeMatchesWin(player, roundIndexMax);
		var byeCount = this.computeByeCount(player, roundIndexMax);
		var drawCount = this.computeMatchesDraw(player, roundIndexMax);
		return (3 * (winCount + byeCount) + drawCount);
	}

	computePlayerMatchWinPercent(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var matchPoints = this.computePlayerMatchPoints(player, roundIndexMax);

		var roundsPlayed = this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
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

	computeOpponentMatchWinPercent(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var matches = this.playerMatches(player, null, roundIndexMax);

		var acc = 0;
		var opponentCount = 0;

		for (var i = 0; i < matches.length; i++)
		{
			var match = matches[i];
			if (!match.bye && match.finished)
			{
				var opponentName = (match.playerName == player.name ? match.opponentName : match.playerName);
				var opponent = this.getPlayerFromName(opponentName);
				if (opponent)
				{
					acc += this.computePlayerMatchWinPercent(opponent, roundIndexMax);
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

	computePlayerGamePoints(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var res = this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
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

	computePlayerGameWinPercent(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var gamePoints = this.computePlayerGamePoints(player, roundIndexMax);

		var gamesPlayed = this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
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

	computeOpponentGameWinPercent(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		var matches = this.playerMatches(player, null, roundIndexMax);

		var acc = 0;
		var opponentCount = 0;
		
		for (var i = 0; i < matches.length; i++)
		{
			var match = matches[i];
			if (!match.bye && match.finished)
			{
				var opponentName = (match.playerName == player.name ? match.opponentName : match.playerName);
				var opponent = this.getPlayerFromName(opponentName);
				if (opponent)
				{
					acc += this.computePlayerGameWinPercent(opponent, roundIndexMax);
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

	currentRoundScoresEntered()
	{
		var currentRound = this.currentRound();

		if (currentRound >= 0)
		{
			var res = this.rounds[currentRound].reduce((acc, match) => {
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

	canCreateNewRound()
	{
		if (this.roundCount() < this.roundMaxCount())
		{
			return true;
		}

		return false;
	}

	canCancelCurrentRound()
	{
		if (this.roundCount() > 0)
		{
			return true;
		}

		return false;
	}

	tryToPairPlayers(playersToPair, onlyPerfectMatches)
	{
		// If no players left to pair
		if (playersToPair.length == 0)
		{
			// Return empty list of matches
			return {
				"diff": 0,
				"matches": []
			};
		}

		// Take first player from playersToPair, remove player from playersToPair
		var p1 = playersToPair.shift();

		// Check the bye (last player)
		if (playersToPair.length == 0)
		{
			// Compute player bye count
			var playerByeCount = this.computeByeCount(p1.player);

			// Check if there is another player who should have the bye
			var canBye = this.players.every(p => ((this.computeByeCount(p) >= playerByeCount) && (this.computePlayerMatchPoints(p) >= p1.matchPoints)));
			if (canBye)
			{
				// The bye is valid
				var byeMatch = this.createMatch(true, p1.player.name);

				// Return success
				return {
					"diff": 0,
					"matches": [byeMatch]
				};
			}
			else
			{
				// Return fail (another player should have the bye)
				return false;
			}
		}

		var results = [];

		// Parse opponents
		for (var o = 0; o < playersToPair.length; o++)
		{
			// Take opponent[o]
			var p2 = playersToPair[o];

			if (this.matchAlreadyPlayed(p1.player, p2.player))
			{
				continue;
			}

			if (onlyPerfectMatches && (p1.matchPoints != p2.matchPoints))
			{
				continue;
			}

			// Copy playersToPair
			var newPlayersToPair = playersToPair.filter(p => (p.player != p2.player));

			// recursive call for trying to pair remaining players, get matches as result
			var res = this.tryToPairPlayers(newPlayersToPair, onlyPerfectMatches);

			if (res)
			{
				var match = this.createMatch(false, p1.player.name, p2.player.name);

				// Add match to matches
				res.matches.unshift(match);

				res.diff += Math.abs(p1.matchPoints - p2.matchPoints);

				results.push(res);
			}
		}

		if (results.length > 0)
		{
			var bestMatches = results.reduce((v1, v2) => ((v1.diff <= v2.diff) ? v1 : v2));

			// Return success
			return bestMatches;
		}

		// Return fail (to find an opponent)
		return false;
	}
	
	newRound()
	{
		var nextPlayers = this.players.filter(p => (p.drop === false));

		if (nextPlayers.length < 2)
		{
			return;
		}

		var round = this.roundCount();

		if (round >= this.roundMaxCount())
		{
			return;
		}

		if (!this.currentRoundScoresEntered())
		{
			alert("Please enter all scores.");
			return;
		}

		console.log("New round", round + 1);

		var t1 = performance.now();

		this.generateTiebreaker4();

		var playersToPair = [];

		for (var i = 0; i < nextPlayers.length; i++)
		{
			var player = nextPlayers[i];
			var matchPoints = this.computePlayerMatchPoints(player);
			playersToPair.push({
				"player": player,
				"matchPoints": matchPoints
			});
		}

		playersToPair.sort((v1, v2) => {
			// Match points DESC
			if (v1.matchPoints != v2.matchPoints)
			{
				return (v2.matchPoints - v1.matchPoints);
			}

			// Tie breaker 4 DESC
			if (v1.player.tb4 != v2.player.tb4)
			{
				return (v2.player.tb4 - v1.player.tb4);
			}
		});

		var result = this.tryToPairPlayers(playersToPair.slice(), true);

		if (!result)
		{
			result = this.tryToPairPlayers(playersToPair.slice(), false);
		}

		var t2 = performance.now();

		console.log("Computing time", (t2 - t1));

		console.log("matches", result.matches);

		this.rounds[round] = result.matches;

		this.selectedRound = round;

		this.generateTiebreaker4();
		this.sortPlayers();

		this.save();
	}

	generateTiebreaker4()
	{
		// Regenerate Tiebreaker 4
		for (var i = 0; i < this.players.length; i++)
		{
			var player = this.players[i];
			do
			{
				player.tb4 = Math.floor(1000 * Math.random());
			}
			while (this.players.some(p => ((p.name != player.name) && (p.tb4 == player.tb4))));
		}
	}

	cancelCurrentRound()
	{
		if (!confirm("You will CANCEL THE LAST ROUND matches. Are you sure?"))
		{
			return;
		}

		if (this.roundCount() <= 0)
		{
			return;
		}

		this.rounds.pop();

		if (this.roundCount() == 0)
		{
			this.players.map(player => player.tb4 = 0);
		}

		var currentRound = this.roundCount() - 1;

		this.players.map(player => {
			if (player.drop >= currentRound)
			{
				player.drop = false;
			}
		});

		if (this.selectedRound >= this.roundCount())
		{
			this.selectedRound = Math.max(0, currentRound);
		}
		
		this.sortPlayers();

		this.save();
	}

	updateScore(match)
	{
		this.sortPlayers();

		this.save();
	}

	reset()
	{
		if (!confirm("You will RESET ALL DATA. Are you sure?"))
		{
			return;
		}

		this.players = [];
		this.rounds = [];
		this.selectedRound = 0;
		this.selectedPlayer = null;

		this.sortPlayers();

		this.save();
	}

	addPlayerKeyPress($event, playerNameToAdd)
	{
		if ($event.which == 13)
		{
			this.addPlayer(playerNameToAdd);
		}
	}

	addPlayer(playerName)
	{
		if (playerName == "")
		{
			return;
		}

		if (this.getPlayerFromName(playerName))
		{
			alert("Player name already exists!");
			return;
		}

		this.playerNameToAdd = "";

		this.players.push(this.createPlayer(playerName));
		
		this.sortPlayers();

		this.save();
	}

	removePlayer(player)
	{
		if (!confirm("You will DELETE " + player.name + ". Are you sure?"))
		{
			return;
		}

		var idx = this.players.indexOf(player);

		if (idx >= 0)
		{
			this.players.splice(idx, 1);
		}

		this.sortPlayers();
		
		this.save();
	}

	save()
	{
		console.log("save");

		var players2 = this.serializePlayers();
		var rounds2 = this.serializeRounds();

		Cookie.saveData("players", players2);
		Cookie.saveData("rounds", rounds2);
		Cookie.saveData("selectedRound", this.selectedRound);
		
		console.log("players", this.players);
		console.log("rounds", this.rounds);
	}

	load()
	{
		console.log("load");

		var players = Cookie.loadData("players");
		if (players)
		{
			this.players = this.deserializePlayers(players);
		}

		console.log("Players", this.players);

		var matches = Cookie.loadData("rounds");
		if (matches)
		{
			this.rounds = this.deserializeRounds(matches);
		}

		console.log("Rounds", this.rounds);

		var selectedRoundT = Cookie.loadData("selectedRound");
		if (selectedRoundT)
		{
			this.selectedRound = selectedRoundT;
		}
	}

	serializePlayers()
	{
		return this.players.map(p => [p.name, p.tb4, p.drop]);
	}

	deserializePlayers(players)
	{
		return players.map(p => this.createPlayer(p[0], p[1], p[2]));
	}

	serializeRounds()
	{
		return this.rounds.map(r => r.map(m => [m.bye, m.playerName, m.opponentName, m.playerScore, m.opponentScore, m.finished]));
	}

	deserializeRounds(matches)
	{
		return matches.map(r => r.map(m => this.createMatch(m[0], m[1], m[2], m[3], m[4], m[5])));
	}

	export()
	{
		var jsonObj = {
			version: "0.1",
			origin: (document.location.href || ""),
			players: this.players,
			rounds: this.rounds,
			selectedRound: this.selectedRound
		};
		var jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(angular.toJson(jsonObj));
		var dlAnchorElem = document.createElement('a');
		dlAnchorElem.setAttribute("href", jsonStr);
		var now = new Date();
		var fileName = "MTG-Tournament-" + now.getFullYear() + now.getMonth() + now.getDay() + "-" + now.getHours() + now.getMinutes() + now.getSeconds() + ".json";
		dlAnchorElem.setAttribute("download", fileName);
		dlAnchorElem.click();
	}

	loadFile(file)
	{
		if (!file || !file.name || !file.name.endsWith(".json"))
		{
			return Promise.reject("Bad file format");
		}

		console.log("Import", file);

		return this.q((resolve, reject) => {
			var reader = new FileReader();
			reader.onload = (e) => resolve(reader.result);
			reader.onerror = (e) => reject(e);
			reader.readAsText(file);
		});
	}

	importFileChange(event)
	{
		var files = event.target.files;

		if (files.length <= 0)
		{
			return;
		}

		if (files.length > 1)
		{
			throw "Select one file";
		}

		this.loadFile(files[0]).then((data) => {
			var json = JSON.parse(data);
			this.players = json.players;
			this.rounds = json.rounds;
			this.selectedRound = json.selectedRound;
			this.sortPlayers();
			this.save();
		}).catch((reason) => {
			console.error("File load failed", reason);
			alert("File load failed");
		});
	}

	import()
	{
		setTimeout(() => {
			document.querySelector('#importFile').click();
		}, 100);
	}
}
