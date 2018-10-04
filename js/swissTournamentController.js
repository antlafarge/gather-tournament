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
		
		this.MatchState = MatchState;

		this.players = [];
		this.rounds = [];
		this.selectedRound = 0;
		
		this.sortedPlayers = [];
		this.allScores = [];
		this.playerNameToAdd = "";
		this.selectedPlayerId = null;

		this.load();

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

	createMatch(matchState, playerId, opponentId, playerScore, opponentScore)
    {
        return {
			"state": (matchState || MatchState.Pending),
            "p1": (playerId >= 0 ? playerId : -1),
            "p2": (opponentId >= 0 ? opponentId : -1),
            "score1": (playerScore || 0),
            "score2": (opponentScore || 0)
        };
	}

	canDrop(playerId)
	{
		let player = this.players[playerId];

		if (player == null)
		{
			throw "Can't find player";
		}

		if (player.drop !== false || this.roundCount() === 0 || this.roundCount() === this.roundMaxCount() || this.selectedRound != this.currentRound())
		{
			return false;
		}

		let lastMatch = this.playerMatches(playerId).pop();

		if (lastMatch && lastMatch.state !== MatchState.Pending)
		{
			return true;
		}
		else
		{
			return false;
		}
	}
	
	canUndrop(playerId)
	{
		let player = this.players[playerId];

		if (player == null)
		{
			throw "Can't find player";
		}

		if (player.drop !== this.currentRound() || this.roundCount() === 0 || this.roundCount() === this.roundMaxCount() || this.selectedRound != this.currentRound())
		{
			return false;
		}

		let lastMatch = this.playerMatches(playerId).pop();

		if (lastMatch && lastMatch.state !== MatchState.Pending)
		{
			return true;
		}
		else
		{
			return false;
		}
	}
	
	playerDropped(playerId)
	{
		let player = this.players[playerId];

		if (player == null)
		{
			throw "Can't find player";
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
		for (let i = 0; i < 100; i++)
		{
			let playerName = "player_" + this.randChar() + this.randChar() + this.randChar() + this.randChar() + this.randChar() + this.randChar();
			this.addPlayer(playerName);
		}
		console.log("add100RandomPlayers OK");
	}

	fillRandomScores()
	{
		console.log("fillRandomScores...");
		let round = this.rounds.length - 1;
		if (round >= 0)
		{
			let changed = false;
			this.rounds[round].forEach(match =>
			{
				if (match.state === MatchState.Pending)
				{
					match.score1 = Math.floor((Math.random() * 3));
					match.score2 = Math.floor((Math.random() * 3));
					match.state = MatchState.Finished;
					changed = true;
				}
			});

			if (changed)
			{
				this.refreshScores();
				this.save();
			}

			console.log("fillRandomScores OK");
		}
	}

	toggleDropPlayer(playerId)
	{
		let player = this.players[playerId];

		if (player == null)
		{
			throw "Can't find player";
		}

		let round = this.currentRound();

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

	toggleSelectPlayer(playerId)
	{
		if (this.roundCount() <= 0)
		{
			this.selectedPlayerId = null;
			return;
		}

		if (playerId != null && playerId >= 0)
		{
			if (playerId !== this.selectedPlayerId)
			{
				this.selectedPlayerId = playerId;
			}
			else
			{
				this.selectedPlayerId = null;
			}
		}
	}

	canAddPlayer(playerName)
	{
		if (!playerName || playerName.length == 0 || playerName.indexOf('|') !== -1 || playerName.indexOf("\\") !== -1)
		{
			return false;
		}

		if (this.players.length >= 1000)
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

		let playersToPair = this.players.filter(player => player.drop === false);
		if (playersToPair.length >= 2)
		{
			return false;
		}

		return true;
	}

	selectRound(round)
	{
		this.selectedRound = round;
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
		let i = 0;
		let res = 1;
		while (res < x)
		{
			i++;
			res *= 2;
		}
		return i;
	}

	refreshScores(refreshAll, players)
	{
		// Sort player list
		if (refreshAll || this.sortedPlayers.length === 0 || this.roundCount() === 0)
		{
			this.sortedPlayers = this.players.map(p => p).sort((p1, p2) =>
			{
				return (p1.name.localeCompare(p2.name));
			});
		}

		// Recompute scores
		if (!this.allScores)
		{
			this.allScores = [];
		}
		this.allScores.length = this.roundCount();

		for (let round = 0; round < this.allScores.length; round++)
		{
			let scores = this.allScores[round];
			if (!scores)
			{
				this.allScores[round] = scores = [];
			}

			scores.length = this.players.length;

			for (let playerId = 0; playerId < this.players.length; playerId++)
			{
				let score = scores[playerId];
				if (!score)
				{
					scores[playerId] = score = {
						matchesWin: 0,
						matchesDraw: 0,
						matchesLoose: 0,
						byes: 0,
		
						matchPoints: 0,
						gamePoints: 0,
						
						matchWinPercent: 0,
						opponentMatchWinPercent: 0,
		
						gameWinPercent: 0,
						opponentGameWinPercent: 0
					};
				}

				score.playerId = playerId;
				score.player = this.players[playerId];

				let matches = this.playerMatches(playerId, -1, round);

				score.matchesWin = this.computeMatchesWin(playerId, matches);
				score.matchesDraw = this.computeMatchesDraw(matches);
				score.matchesLoose = this.computeMatchesLoose(playerId, matches);
				score.byes = this.computeByeCount(matches);

				score.matchPoints = this.computePlayerMatchPoints(playerId, matches);//3 * score.matchesWin + score.matchesDraw;
				score.matchWinPercent = this.computePlayerMatchWinPercent(playerId, matches);
				score.opponentMatchWinPercent = this.computeOpponentMatchWinPercent(playerId, matches);
				
				score.gamePoints = this.computePlayerGamePoints(playerId, matches);
				score.gameWinPercent = this.computePlayerGameWinPercent(playerId, matches);
				score.opponentGameWinPercent = this.computeOpponentGameWinPercent(playerId, matches);
			}
		}

		this.allScores.forEach(scores => scores.sort((score1, score2) =>
		{
			// Match points DESC
			if (score1.matchPoints != score2.matchPoints)
			{
				return (score2.matchPoints - score1.matchPoints);
			}

			// Tie breaker 1 DESC
			if (score1.opponentMatchWinPercent != score2.opponentMatchWinPercent)
			{
				return (score2.opponentMatchWinPercent - score1.opponentMatchWinPercent);
			}

			// Tie breaker 2 DESC
			if (score1.gameWinPercent != score2.gameWinPercent)
			{
				return (score2.gameWinPercent - score1.gameWinPercent);
			}

			// Tie breaker 3 DESC
			if (score1.opponentGameWinPercent != score2.opponentGameWinPercent)
			{
				return (score2.opponentGameWinPercent - score1.opponentGameWinPercent);
			}

			// Tie breaker 4 DESC
			if (score1.player.tb4 != score2.player.tb4)
			{
				return (score2.player.tb4 - score1.player.tb4);
			}

			// random sort DESC
			return (Math.random() > 0.5 ? 1 : -1);
		}));
	}

	playerMatches(playerId1, playerId2, roundIndexMax)
	{
		if (playerId1 === -1)
		{
			return [];
		}

		if (!playerId2)
		{
			playerId2 = -1;
		}

		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		let filteredRounds = this.rounds.map((round, index) =>
		{
			if (index <= roundIndexMax)
			{
				return round.filter(match => (((match.p1 === playerId1 && (playerId2 === -1 || match.p2 == playerId2)) || (match.p2 == playerId1 && (playerId2 === -1 || match.p1 == playerId2)))));
			}
			return [];
		});
		return Array.prototype.concat.apply([], filteredRounds);
	}

	playerMatchesWinDiff(playerId1, playerId2, roundIndexMax)
	{
		if (playerId1 == null || playerId2 == null || playerId1 === -1 || playerId2 === -1)
		{
			return false;
		}

		let playerMatches = this.playerMatches(playerId1, playerId2, roundIndexMax);
		if (playerMatches.length == 0)
		{
			return false;
		}

		if (playerMatches.every(match => match.state !== MatchState.Finished))
		{
			return false;
		}

		let winDiff = playerMatches.reduce((acc, match) =>
		{
			if ((match.p1 == playerId1 && match.score1 > match.score2) || (match.p2 == playerId1 && match.score2 > match.score1))
			{
				acc++;
			}
			else if ((match.p1 == playerId2 && match.score1 > match.score2) || (match.p2 == playerId2 && match.score2 > match.score1))
			{
				acc--;
			}
			return acc;
		}, 0);
		return winDiff;
	}

	matchAlreadyPlayed(playerId1, playerId2, roundIndexMax)
	{
		if (!playerId1 || !playerId2)
		{
			return 0;
		}
		
		roundIndexMax = (roundIndexMax >= 0 ? roundIndexMax : +Infinity);

		return this.playerMatches(playerId1, playerId2, roundIndexMax).length;
	}

	getPlayerFromName(playerName)
	{
		return this.players.find(player => (player.name === playerName));
	}

	computeMatchesWin(playerId, matches)
	{
		let matchesWin = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished && ((match.p1 === playerId && match.score1 > match.score2) || (match.p2 === playerId && match.score1 < match.score2))
			|| match.state === MatchState.Bye && match.p1 === playerId)
			{
				matchesWin++;
			}
		}
		return matchesWin;
	}

	hasABye(matches)
	{
		return matches.some(match => match.state === MatchState.Bye);
	}

	computeByeCount(matches)
	{
		let byes = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Bye)
			{
				byes++;
			}
		}
		return byes;
	}

	computeMatchesLoose(playerId, matches)
	{
		let matchesLoose = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished)
			{
				if ((match.p1 === playerId && match.score1 < match.score2)
				|| (match.p2 === playerId && match.score1 > match.score2))
				{
					matchesLoose++;
				}
			}
		}
		return matchesLoose;
	}

	computeMatchesDraw(matches)
	{
		let matchesDraw = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished && match.score1 === match.score2)
			{
				matchesDraw++;
			}	
		}
		return matchesDraw;
	}

	computePlayerMatchPoints(playerId, matches)
	{
		let winCount = this.computeMatchesWin(playerId, matches);
		let drawCount = this.computeMatchesDraw(matches);
		return (3 * winCount + drawCount);
	}

	computePlayerMatchWinPercent(playerId, matches)
	{
		let roundsPlayed = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state !== MatchState.Pending)
			{
				roundsPlayed++;
			}
		}
		
		let res = 0;
		
		if (roundsPlayed > 0)
		{
			let matchPoints = this.computePlayerMatchPoints(playerId, matches);
			res = matchPoints / (3 * roundsPlayed);
		}

		if (res < (1 / 3))
		{
			res = (1 / 3);
		}

		return res;
	}

	computeOpponentMatchWinPercent(playerId, matches)
	{
		let acc = 0;
		let opponentCount = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished)
			{
				let opponentId = (match.p1 === playerId ? match.p2 : match.p1);
				acc += this.computePlayerMatchWinPercent(opponentId, matches);
				opponentCount++;
			}
		}

		let res = 0;

		if (opponentCount > 0)
		{
			res = acc / opponentCount;
		}

		if (res < (1 / 3))
		{
			res = (1 / 3);
		}

		return res;
	}

	computePlayerGamePoints(playerId, matches)
	{
		let gamePoints = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished)
			{
				let playerScore = (match.p1 === playerId ? match.score1 : match.score2);
				gamePoints += (3 * playerScore);
			}
			else if (match.state === MatchState.Bye)
			{
				gamePoints += (3 * 2); // TODO (this is hardcoded)
			}
		}
		return gamePoints;
	}

	computePlayerGameWinPercent(playerId, matches)
	{
		let gamesPlayed = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished)
			{
				gamesPlayed += (match.score1 + match.score2);
			}
			else if (match.state === MatchState.Bye)
			{
				gamesPlayed += 2;
			}
		}

		let res = 0;

		if (gamesPlayed > 0)
		{
			let gamePoints = this.computePlayerGamePoints(playerId, matches);
			res = gamePoints / (3 * gamesPlayed);
		}

		if (res < (1 / 3))
		{
			res = (1 / 3);
		}

		return res;
	}

	computeOpponentGameWinPercent(playerId, matches)
	{
		let acc = 0;
		let opponentCount = 0;
		for (let i = 0; i < matches.length; i++)
		{
			let match = matches[i];
			if (match.state === MatchState.Finished)
			{
				let opponentId = (match.p1 === playerId ? match.p2 : match.p1);
				acc += this.computePlayerGameWinPercent(opponentId, matches);
			}
		}

		let res = 0;

		if (opponentCount > 0)
		{
			res = acc / opponentCount;
		}

		if (res < (1 / 3))
		{
			res = (1 / 3);
		}

		return res;
	}

	forDisplay(value)
	{
		return (value ? value : "-");
	}

	currentRoundScoresEntered()
	{
		let currentRound = this.currentRound();

		if (currentRound < 0)
		{
			return false;
		}

		let oneMatchNotFinished = this.rounds[currentRound].some(match => match.state === MatchState.Pending);
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
				let playersReadyToNewRound = this.players.filter(p => p.drop === false);
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
		for (let p = 0; p < players.length; p += 2) // We ignore the last player if players.length is odd (bye)
		{
			let player = players[p];
			let opponent = players[p + 1]

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

			persistantData.onlyPerfect = false;

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
					let persistantData2 = e.data.persistantData;

					if (res)
					{
						resolve({
							result: result,
							persistantData: persistantData2
						});
					}
					else
					{
						if (data.persistantData.onlyPerfect)
						{
							data.persistantData.onlyPerfect = false;
							computingWorker.postMessage(data); // second pass (not only perfect matches)
						}
						else
						{
							resolve(null);
						}
					}
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

		let playersToPair = this.players.filter(player => player.drop === false);
		
		if (playersToPair.length < 2)
		{
			alert("Not enough remaining player!");
			return;
		}

		playersToPair = playersToPair.map(player =>
		{
			let playerId = this.players.indexOf(player);
			let matches = this.playerMatches(playerId);
			return {
				"player": player,
				"id": playerId,
				"matchPoints": this.computePlayerMatchPoints(playerId, matches),
				"byeCount": this.computeByeCount(matches),
				"potentialOpponents": playersToPair.filter(opponent => player !== opponent && !this.matchAlreadyPlayed(playerId, this.players.indexOf(opponent))),
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

		//this.generateTiebreaker4();

		playersToPair = playersToPair.sort((p1, p2) => (p2.matchPoints - p1.matchPoints) || (p1.player.tb4 - p2.player.tb4)); // Sort Match points DESC, Tie breaker 4 DESC

		console.log("playersToPair", playersToPair);

		let bye = (playersToPair.length % 2 === 1);

		let result = {
			"score": 0,
			"matches": []
		};

		let persistantData = {
			"minScore": +Infinity,
			"passes": 0,
			"skips": [],
			"timeout": +Infinity,//(this.players.length / 10), // seconds
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

			for (let i = 0; i < maxThreads; i++)
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
				let byeMatch = this.createMatch(MatchState.Bye, bestData.byePlayer.id);
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

			//this.generateTiebreaker4();

			this.refreshScores();

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
		for (let i = 0; i < this.players.length; i++)
		{
			let player = this.players[i];
			do
			{
				player.tb4 = Math.floor(10001 * Math.random());
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

		let currentRound = this.currentRound();

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
		
		this.refreshScores();

		this.save();
	}

	updateScore(match)
	{
		this.refreshScores();

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
		this.selectedPlayerId = null;

		this.refreshScores(true);

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
		if (this.roundCount() > 0)
		{
			return;
		}

		if (!playerName || playerName.includes('|') || playerName.includes('/'))
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
		
		this.refreshScores(true);

		this.save();
	}

	removePlayer(player)
	{
		if (!player)
		{
			return;
		}

		if (this.roundCount() > 0)
		{
			return;
		}

		if (!confirm("You will DELETE " + player.name + ". Are you sure?"))
		{
			return;
		}

		let idx = this.players.indexOf(player);

		if (idx >= 0)
		{
			this.players.splice(idx, 1);
		}

		this.refreshScores(true);
		
		this.save();
	}

	save()
	{
		let players2 = this.serializePlayers();
		let rounds2 = this.serializeRounds();

		Cookie.saveData("players", players2);
		Cookie.saveData("rounds", rounds2);
		
		console.log("save");

		console.log("players", this.players);
		console.log("rounds", this.rounds);
	}

	load()
	{
		console.log("load");

		let players = Cookie.loadData("players");
		if (players)
		{
			this.players = this.deserializePlayers(players);
		}

		console.log("Players", this.players);

		let matches = Cookie.loadData("rounds");
		if (matches)
		{
			this.rounds = this.deserializeRounds(matches);
		}

		console.log("Rounds", this.rounds);

		this.selectedRound = this.currentRound();

		this.refreshScores(true);
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
			return this.createPlayer(p[0], p[1], (p[2] != null ? parseInt(p[2]) : false));
		});
	}

	serializeRounds()
	{
		return this.rounds.map(r => r.map(m => m.p1 + '/' + m.score1 + (m.state === MatchState.Bye ? '': ('/' + m.score2 + '/' + m.p2 + '/'))).join('|')).join('{');
	}

	deserializeRounds(matches)
	{
		let rounds = matches.split('{').map(r => r.split('|').map(m2 =>
		{
			let m = m2.split('/');
			return this.createMatch((m[3] ? MatchState.Finished : MatchState.Bye), parseInt(m[0]), parseInt(m[3]), parseInt(m[1]), parseInt(m[2]));
		}));
		return rounds;
	}

	export()
	{
		let jsonObj = {
			version: "0.1",
			origin: (document.location.href || ""),
			players: this.players,
			rounds: this.rounds,
			selectedRound: this.selectedRound
		};
		let jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(angular.toJson(jsonObj));
		let dlAnchorElem = document.createElement('a');
		dlAnchorElem.setAttribute("href", jsonStr);
		let now = new Date();
		let fileName = "MTG-Tournament-" + now.getFullYear() + now.getMonth() + now.getDay() + "-" + now.getHours() + now.getMinutes() + now.getSeconds() + ".json";
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
			let reader = new FileReader();
			reader.onload = (e) => resolve(reader.result);
			reader.onerror = (e) => reject(e);
			reader.readAsText(file);
		});
	}

	importFileChange(event)
	{
		let files = event.target.files;

		if (files.length <= 0)
		{
			return;
		}

		if (files.length > 1)
		{
			throw "Select one file";
		}

		this.loadFile(files[0])
			.then((data) =>
		{
				let json = JSON.parse(data);
			this.players = json.players;
			this.rounds = json.rounds;
			this.selectedRound = json.selectedRound;
			this.refreshScores(true);
			this.save();
		})
			.catch((reason) =>
		{
			console.error("File load failed", reason);
			alert("File load failed");
		});
	}

	import()
	{
		setTimeout(() =>
		{
			document.querySelector('#importFile').click();
		}, 200);
	}
}
