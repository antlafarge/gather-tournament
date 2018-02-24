import {Cookie} from './cookie.js'

export class mainController
{
    constructor($scope)
    {
        this.players = [];
        this.rounds = [];
        this.selectedRound = 0;
        
        this.sortedPlayers = [];
        this.playerNameToAdd = "";

        this.load();
        this.sortPlayers();
        
        $scope.ctrl = this;
        this.scope = $scope;
    }

    canAddPlayer(playerName)
    {
        if (playerName.length == 0)
        {
            return false;
        }
        return this.players.every(p => (p.name != playerName));
    }

    selectRound(round)
    {
        this.selectedRound = round;
        this.save();
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
            // Match points
            var PMP1 = this.computePlayerMatchPoints(p1);
            var PMP2 = this.computePlayerMatchPoints(p2);
            if (PMP1 != PMP2)
            {
                return (PMP2 - PMP1);
            }

            // Tie breaker 1
            var OMWP1 = this.computeOpponentMatchWinPercent(p1);
            var OMWP2 = this.computeOpponentMatchWinPercent(p2);
            if (OMWP1 != OMWP2)
            {
                return (OMWP2 - OMWP1);
            }

            // Tie breaker 2
            var PGWP1 = this.computePlayerGameWinPercent(p1);
            var PGWP2 = this.computePlayerGameWinPercent(p2);
            if (PGWP1 != PGWP2)
            {
                return (PGWP2 - PGWP1);
            }

            // Tie breaker 3
            var OGWP1 = this.computeOpponentGameWinPercent(p1);
            var OGWP2 = this.computeOpponentGameWinPercent(p2);
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

    playerMatches(playerName)
    {
        var filteredRounds = this.rounds.map((round, index) => {
            if (index <= this.selectedRound)
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

    matchAlreadyPlayed(p1, p2)
    {
        return this.rounds.some(round => round.some(match => ((match.playerName == p1.name && match.opponentName == p2.name) || (match.playerName == p2.name && match.opponentName == p1.name))));
    }

    createPlayer(playerName, tb4)
    {
        return {
            "name": playerName,
            "tb4": (tb4 || 0)
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

    searchForAPlayer(playerName)
    {
        return this.players.find(player => (player.name == playerName));
    }

    computeMatchesWin(player)
    {
        return this.playerMatches(player.name).reduce((acc, match) => {
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

    computeByeCount(player)
    {
        return this.playerMatches(player.name).reduce((acc, match) => {
            if (match.bye)
            {
                acc += 1;
            }
            return acc;
        }, 0);
    }

    computeMatchesLoose(player)
    {
        return this.playerMatches(player.name).reduce((acc, match) => {
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

    computeMatchesDraw(player)
    {
        return this.playerMatches(player.name).reduce((acc, match) => {
            if (match.finished && (match.playerScore == match.opponentScore))
            {
                acc += 1;
            }
            return acc;
        }, 0);
    }

    computePlayerMatchPoints(player)
    {
        var winCount = this.computeMatchesWin(player);
        var byeCount = this.computeByeCount(player);
        var drawCount = this.computeMatchesDraw(player);
        return (3 * (winCount + byeCount) + drawCount);
    }

    computePlayerMatchWinPercent(player)
    {
        var matchPoints = this.computePlayerMatchPoints(player);

        var roundsPlayed = this.playerMatches(player.name).reduce((acc, match) => {
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

    computeOpponentMatchWinPercent(player)
    {
        var matches = this.playerMatches(player.name);

        var acc = 0;
        var opponentCount = 0;

        for (var i = 0; i < matches.length; i++)
        {
            var match = matches[i];
            if (!match.bye && match.finished)
            {
                var opponentName = (match.playerName == player.name ? match.opponentName : match.playerName);
                var opponent = this.searchForAPlayer(opponentName);
                if (opponent)
                {
                    acc += this.computePlayerMatchWinPercent(opponent);
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

    computePlayerGamePoints(player)
    {
        var res = this.playerMatches(player.name).reduce((acc, match) => {
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

    computePlayerGameWinPercent(player)
    {
        var gamePoints = this.computePlayerGamePoints(player);

        var gamesPlayed = this.playerMatches(player.name).reduce((acc, match) => {
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

    computeOpponentGameWinPercent(player)
    {
        var matches = this.playerMatches(player.name);

        var acc = 0;
        var opponentCount = 0;
        
        for (var i = 0; i < matches.length; i++)
        {
            var match = matches[i];
            if (!match.bye && match.finished)
            {
                var opponentName = (match.playerName == player.name ? match.opponentName : match.playerName);
                var opponent = this.searchForAPlayer(opponentName);
                if (opponent)
                {
                    acc += this.computePlayerGameWinPercent(opponent);
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

    lastRoundScoresEntered()
    {
        var lastRound = this.roundCount() - 1;

        if (lastRound >= 0)
        {
            var res = this.rounds[lastRound].reduce((acc, match) => {
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

    canCancelLastRound()
    {
        if (this.roundCount() > 0)
        {
            return true;
        }

        return false;
    }

    takeUnplayedOpponents(player, playersToPair)
    {
        return playersToPair.filter(opponent => (player != opponent && !this.matchAlreadyPlayed(player, opponent)));
    }

    tryToPairPlayers(playersToPair, random)
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
            var playerByeCount = this.computeByeCount(player);

            // Check if there is another player who should have the bye
            var canBye = this.players.every(p => (this.computeByeCount(p) >= playerByeCount));
            if (canBye)
            {
                // The bye is valid
                var byeMatch = this.createMatch(true, player.name);

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
        var availableOpponents = this.takeUnplayedOpponents(player, playersToPair);

        if (random)
        {
            // Randomize opponents by grouping player match points
            availableOpponents.sort((p1, p2) => {
                // Match points
                var PMP1 = this.computePlayerMatchPoints(p1);
                var PMP2 = this.computePlayerMatchPoints(p2);
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
            var matches = this.tryToPairPlayers(newPlayersToPair, random);
            if (matches)
            {
                // We succeed to pair the remaining players, create the match
                var match = this.createMatch(false, player.name, opponent.name);

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
    
    newRound()
    {
        if (this.players.length < 2)
        {
            return;
        }

        var round = this.roundCount();

        if (round >= this.roundMaxCount())
        {
            return;
        }

        if (!this.lastRoundScoresEntered())
        {
            alert("Please enter all scores.");
            return;
        }

        console.log("New round", round + 1);

        this.generateTiebreaker4();
        this.sortPlayers();

        var playersToPair = this.sortedPlayers.slice();

        var matches = this.tryToPairPlayers(playersToPair, true);

        console.log("matches", matches);

        this.rounds[round] = matches;

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
                player.tb4 = Math.floor(1000000 * Math.random());
            }
            while (this.players.some(p => ((p.name != player.name) && (p.tb4 == player.tb4))));
        }
    }

    cancelLastRound()
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

        this.sortPlayers();

        if (this.selectedRound >= this.roundCount())
        {
            this.selectedRound = Math.max(0, this.roundCount() - 1);
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

        if (this.searchForAPlayer(playerName))
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
        
        console.log(this.players);
        console.log(this.rounds);
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
        return this.players.map(p => [p.name, p.tb4]);
    }

    deserializePlayers(players)
    {
        return players.map(p => this.createPlayer(p[0], p[1]));
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

        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = (e) => resolve(reader.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    importFileChange(files)
    {
        if (files.length != 1)
        {
            throw "Select one file";
        }

        this.loadFile(files[0]).then((data) => {
            var json = JSON.parse(data);
            this.players = json.players;
            this.rounds = json.rounds;
            this.selectedRound = json.selectedRound;
            this.sortPlayers();
            this.scope.$apply();
            this.save();
        }).catch((reason) => {
            alert(reason);
        });
    }

    import()
    {
        document.querySelector('#importFile').click();
    }
}
