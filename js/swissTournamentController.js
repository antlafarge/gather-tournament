import {Cookie} from './cookie.js'

export let MatchState =
{
	Pending: 0,
	Finished: 1,
	Bye: 2
};

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
			"drop": (drop >= 0 ? drop : false)
        };
    }

	createMatch(matchState, playerName, opponentName, playerScore, opponentScore)
    {
        return {
			"state": (matchState || MatchState.Pending),
            "p1": (playerName || ""),
            "p2": (opponentName || ""),
            "score1": (playerScore || 0),
            "score2": (opponentScore || 0)
        };
	}

	canDrop(playerName)
	{
		var player = this.getPlayerFromName(playerName);

		if (player == null)
		{
			throw new Exception("Can't find player");
		}

		if (player.drop !== false || this.roundCount() === 0 || this.roundCount() === this.roundMaxCount() || this.selectedRound != this.currentRound())
		{
			return false;
		}

		var lastMatch = this.playerMatches(player).pop();

		if (lastMatch && lastMatch.state !== MatchState.Pending)
		{
			return true;
		}
		else
		{
			return false;
		}
	}
	
	canUndrop(playerName)
	{
		var player = this.getPlayerFromName(playerName);

		if (player == null)
		{
			throw new Exception("Can't find player");
		}

		if (player.drop !== this.currentRound() || this.roundCount() === 0 || this.roundCount() === this.roundMaxCount() || this.selectedRound != this.currentRound())
		{
			return false;
		}

		var lastMatch = this.playerMatches(player).pop();

		if (lastMatch && lastMatch.state !== MatchState.Pending)
		{
			return true;
		}
		else
		{
			return false;
		}
	}
	
	playerDropped(playerName)
	{
		var player = this.getPlayerFromName(playerName);

		if (player == null)
		{
			throw new Exception("Can't find player");
		}

		return (player.drop !== false) && (player.drop <= this.selectedRound);
	}

	randChar()
	{
		return String.fromCharCode(65 + Math.floor(Math.random() * 26));
	}

	add100RandomPlayers()
	{
		console.log("add100RandomPlayers...");
		for (var i = 0; i < 100; i++)
		{
			let playerName = "player_" + this.randChar() + this.randChar() + this.randChar() + this.randChar();
			this.addPlayer(playerName);
		}
		console.log("add100RandomPlayers OK");
	}

	fillRandomScores()
	{
		console.log("fillRandomScores...");
		let round = this.rounds.length - 1;
		this.rounds[round].forEach(match =>
		{
			if (match.state === MatchState.Pending)
			{
				match.state = MatchState.Finished;
				match.score1 = Math.floor((Math.random() * 3));
				match.score2 = Math.floor((Math.random() * 3));
			}
		});
		console.log("fillRandomScores OK");
	}

	toggleDropPlayer(playerName)
	{
		var player = this.getPlayerFromName(playerName);

		if (player == null)
		{
			throw new Exception("Can't find player");
		}

		var round = this.currentRound();

		if (player.drop !== round)
		{
			player.drop = round;
		}
		else
		{
			player.drop = false;
		}

		this.save();

		return false;
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

		if (this.players.length > 1000)
		{
			return false;
		}

		return (this.getPlayerFromName(playerName) == null);
	}

	canDisplayMedals()
	{
		if (this.selectedRound != this.currentRound())
		{
			return false;
		}
		
		if (!this.currentRoundScoresEntered())
		{
			return false;
		}

		var playersToPair = this.players.filter(player => (player.drop === false));
		if (playersToPair.length >= 2)
		{
			return false;
		}

		return true;
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
		return (this.selectedRound === this.currentRound());
	}

	isLastRound()
	{
		return (this.selectedRound === (this.roundMaxCount() - 1));
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
				return round.filter(match => (((match.p1 == p1.name && (!p2 || match.p2 == p2.name)) || (match.p2 == p1.name && (!p2 || match.p1 == p2.name)))));
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

		if (playerMatches.every(match => match.state !== MatchState.Finished))
		{
			return false;
		}

		var winDiff = playerMatches.reduce((acc, match) => {
			if ((match.p1 == p1.name && match.score1 > match.score2) || (match.p2 == p1.name && match.score2 > match.score1))
			{
				acc++;
			}
			else if ((match.p1 == p2.name && match.score1 > match.score2) || (match.p2 == p2.name && match.score2 > match.score1))
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

	computeMatchesWinPlusBye(player, roundIndexMax)
	{
		return this.computeMatchesWin(player, roundIndexMax) + this.computeByeCount(player, roundIndexMax);
	}

	computeMatchesWin(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
			if (match.state === MatchState.Finished)
			{
				if ((match.p1 == player.name && match.score1 > match.score2)
				|| (match.p2 == player.name && match.score1 < match.score2))
				{
					acc += 1;
				}
			}
			return acc;
		}, 0);
	}

	hasABye(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).some(match => match.state === MatchState.Bye);
	}

	computeByeCount(player, roundIndexMax)
	{
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(player, null, roundIndexMax).reduce((acc, match) => {
			if (match.state === MatchState.Bye)
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
			if (match.state === MatchState.Finished)
			{
				if ((match.p1 == player.name && match.score1 < match.score2)
				|| (match.p2 == player.name && match.score1 > match.score2))
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
			if (match.state === MatchState.Finished && match.score1 == match.score2)
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
			if (match.state !== MatchState.Pending)
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
			if (match.state === MatchState.Finished)
			{
				var opponentName = (match.p1 == player.name ? match.p2 : match.p1);
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
			if (match.state === MatchState.Finished)
			{
				var playerScore = (match.p1 == player.name ? match.score1 : match.score2);
				acc += (3 * playerScore);
			}
			else if (match.state === MatchState.Bye)
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
			if (match.state === MatchState.Finished)
			{
				acc += (match.score1 + match.score2);
			}
			else if (match.state === MatchState.Bye)
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

	forDisplay(value)
	{
		return (value ? value : "-");
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
			if (match.state === MatchState.Finished)
			{
				var opponentName = (match.p1 == player.name ? match.p2 : match.p1);
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

		if (currentRound < 0)
		{
			return false;
		}

		var oneMatchNotFinished = this.rounds[currentRound].some(match => match.state === MatchState.Pending);
		if (oneMatchNotFinished)
		{
			return false;
		}

		return true;
	}

	canCreateNewRound()
	{
		if (this.roundCount() < this.roundMaxCount()) // There is a next round
		{
			if (this.roundCount() == 0 || this.currentRoundScoresEntered()) // There is no rounds, or the scores are entered
			{
				var playersReadyToNewRound = this.players.filter(p => p.drop === false);
				if (playersReadyToNewRound.length >= 2) // There is at least 2 players left (no dropped)
				{
					return true;
				}
			}
		}

		return false;
	}

	canCancelLastRound()
	{
		if (this.roundCount() > 0)
		{
			return true;
		}

		return false;
	}

	computeMinimalPossibleScore(players)
	{
		let minScore = {
			"byMatch": [],
			"total": 0
		};
		for (var p = 0; p < players.length; p += 2) // We ignore the last player if players.length is odd (bye)
		{
			var player = players[p];
			var opponent = players[p + 1]

			let score = 0;
			if (player.matchPoints != opponent.matchPoints)
			{
				score = Math.max(player.matchPoints, opponent.matchPoints) + Math.abs(player.matchPoints - opponent.matchPoints);
				minScore.total += score;
			}
			minScore.byMatch.push(score);
		}
		return minScore;
	}

	tryToPairPlayers(playersToPair, result, persistantData, deep)
	{
		return new Promise((resolve, reject) =>
		{
			let computingWorker = new Worker("js/swissTournamentWorker.js");

			persistantData.onlyPerfect = true;

			let data = {
				"CMD": "START",
				"playersToPair": playersToPair,
				"result": result,
				"persistantData": persistantData,
				"deep": deep
			};

			computingWorker.onmessage = (e) =>
			{
				let CMD = e.data.CMD;
				if (CMD === "END")
				{
					let res = e.data.res;
					let result = e.data.result;
					let persistantData = e.data.persistantData;

					if (!res)
					{
						if (data.onlyPerfect)
						{
							persistantData.onlyPerfect = false;
							computingWorker.postMessage(data); // second pass (not only perfect matches)
						}
						else
						{
							resolve(null);
						}
					}

					resolve({
						result,
						persistantData
					});
				}
				else
				{
					console.log("Computing Webworker:", e.data);
				}
			};

			computingWorker.postMessage(data); // first pass (only perfect matches)
		});
	}
	
	newRound()
	{
		let time1 = performance.now();

		let round = this.roundCount();

		if (round >= this.roundMaxCount())
		{
			return;
		}

		if (this.currentRound() >= 0 && !this.currentRoundScoresEntered())
		{
			alert("Please enter all scores.");
			return;
		}

		let playersToPair = this.players.filter(player => (player.drop === false));
		
		if (playersToPair.length < 2)
		{
			alert("Not enough remaining player!");
			return;
		}

		playersToPair = playersToPair.map(player => {
			return {
				"player": player,
				"matchPoints": this.computePlayerMatchPoints(player),
				"byeCount": this.computeByeCount(player),
				"potentialOpponents": playersToPair.filter(opponent => (player !== opponent && !this.matchAlreadyPlayed(player, opponent))),
				"canBye": true
			};
		});
		
		if (playersToPair.length % 2 == 1)
		{
			playersToPair.forEach(playerInfos => {
				playerInfos.canBye = playersToPair.every(opponentInfos => {
					let playerDropped = (opponentInfos.player.drop !== false);
					let hasMinByeCount = (opponentInfos.byeCount > playerInfos.byeCount);
					let hasEqualByeCount = (opponentInfos.byeCount === playerInfos.byeCount);
					let hasMinMatchPoints = (opponentInfos.matchPoints >= playerInfos.matchPoints);
					return (playerDropped || hasMinByeCount || (hasEqualByeCount && hasMinMatchPoints));
				});
			});
		}

		this.generateTiebreaker4();

		playersToPair = playersToPair.sort((p1, p2) => (p2.matchPoints - p1.matchPoints) || (p1.player.tb4 - p2.player.tb4) || (p1.player.name.localeCompare(p2.player.name))); // Sort Match points DESC, Tie breaker 4 DESC

		console.log("playersToPair", playersToPair);

		let bye = (playersToPair.length % 2 === 1);

		let result = {
			"score": 0,
			"matches": []
		};

		let persistantData = {
			"minScore": +Infinity,
			"passes": 0,
			"skips": {},
			"timeout": 5, // seconds
			"minimalPossibleScore": {
				"byMatch": [],
				"total": 0
			}
		};

		let pairingPromise;

		if (bye)
		{
			let playersTiedToBye = playersToPair.filter(p => p.canBye === true).reverse();
			let promises = [];
			let maxThreads = ((navigator && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency - 1 : 1);

			let launchNext = {
				"f": null
			};

			launchNext.f = () =>
			{
				let byePlayer = playersTiedToBye.shift();
				playersTiedToBye.length = 0;
				if (byePlayer)
				{
					let promise2Resolve;
					let promise2 = new Promise((resolve, reject) =>
					{
						promise2Resolve = resolve;
					});
	
					let newPlayersToPair = playersToPair.filter(p => p != byePlayer);
					let result2 = {
						"score": 0,
						"matches": []
					};
					persistantData.minimalPossibleScore = this.computeMinimalPossibleScore(newPlayersToPair);
					this.tryToPairPlayers(newPlayersToPair, result2, persistantData, -1)
						.then((data) =>
					{
						data.byePlayer = byePlayer;
						promise2Resolve(data);
						launchNext.f();
					});
	
					promises.push(promise2);
				}
			}

			for (var i = 0; i < maxThreads; i++)
			{
				launchNext.f();
			}

			pairingPromise = Promise.all(promises).then(results =>
			{
				let bestData = {
					result: null,
					persistantData: null
				};
				results.forEach(data =>
				{
					if (data)
					{
						let result = data.result;
						let persistantData = data.persistantData;
						if (!bestData.result || result.score < bestData.result.score)
						{
							bestData.result = result;
							bestData.byePlayer = data.byePlayer;
							bestData.persistantData = persistantData;
						}
					}
				});
				let byeMatch = this.createMatch(true, bestData.byePlayer.player.name);
				bestData.result.matches.push(byeMatch);
				return bestData;
			});
		}
		else
		{
			persistantData.minimalPossibleScore = this.computeMinimalPossibleScore(playersToPair);
			pairingPromise = this.tryToPairPlayers(playersToPair, result, persistantData, -1);
		}

		pairingPromise
			.then(data =>
		{
			let result = data.result;
			let persistantData = data.persistantData;

			let time2 = performance.now();

			let generationTime = time2 - time1;

			console.log("New round", round + 1);

			console.log("Pairing generation time:", generationTime);

			console.log("Pairing generation data:", persistantData);

			console.log("result", result);

			this.rounds[round] = result.matches;

			this.selectedRound = round;

			this.generateTiebreaker4();

			this.sortPlayers();

			this.save();

			this.scope.$apply();
		})
			.catch(error =>
		{
			console.error(error);
			alert(error);
		});
	}

	generateTiebreaker4()
	{
		for (var i = 0; i < this.players.length; i++)
		{
			var player = this.players[i];
			do
			{
				player.tb4 = Math.floor(1001 * Math.random());
			}
			while (this.players.some(p => ((p.name != player.name) && (p.tb4 == player.tb4))));
		}
	}

	cancelLastRound()
	{
		if (!this.canCancelLastRound())
		{
			return;
		}

		if (this.roundCount() <= 0) {
			return;
		}

		if (!confirm("You will CANCEL THE LAST ROUND matches. Are you sure?"))
		{
			return;
		}

		this.rounds.pop();

		if (this.roundCount() == 0)
		{
			this.players.map(player => player.tb4 = 0);
		}

		var currentRound = this.currentRound();

		this.players.map(player => {
			if (player.drop > currentRound)
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
		let players2 = this.serializePlayers();
		let rounds2 = this.serializeRounds();

		Cookie.saveData("players", players2);
		Cookie.saveData("rounds", rounds2);
		Cookie.saveData("selectedRound", this.selectedRound);
		
		console.log("save");

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
			this.selectedRound = parseInt(selectedRoundT);
		}
	}

	serializePlayers()
	{
		return this.players.map(p => p.name + '/' + p.tb4 + (p.drop !== false ? ('/' + p.drop) : '')).join('|');
	}

	deserializePlayers(players)
	{
		return players.split('|').map(p2 =>
		{
			let p = p2.split('/');
			return this.createPlayer(p[0], p[1], (p[2] !== undefined ? p[2] : false))
		});
	}

	serializeRounds()
	{
		return this.rounds.map(r => r.map(m => m.p1 + '/' + m.score1 + (m.state === MatchState.Bye ? '': ('/' + m.score2 + '/' + m.p2 + '/'))).join('{')).join('}');
	}

	deserializeRounds(matches)
	{
		var rounds = matches.split('}').map(r => r.split('{').map(m2 =>
		{
			let m = m2.split('/');
			return this.createMatch((m[3] ? MatchState.Finished : MatchState.Bye), m[0], m[3], parseInt(m[1]), parseInt(m[2]));
		}));
		return rounds;
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
