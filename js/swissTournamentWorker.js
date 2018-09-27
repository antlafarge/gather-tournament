let port = self;

port.onmessage = (ev) =>
{
    let CMD = ev.data.CMD;
    if (CMD === "START")
    {
        let playersToPair = ev.data.playersToPair;
        let result = ev.data.result;
        let persistantData = ev.data.persistantData;
        let deep = ev.data.deep;
        let res = tryToPairPlayers(playersToPair, result, persistantData, deep);
        port.postMessage({
            "CMD": "END",
            "res": res,
            "result": result,
            "persistantData": persistantData
        });
    }
    // else if (CMD === "STOP")
    // {
    //     stopRequired = true;
    // }
}

let startPerf = performance.now();
let lastPerf = performance.now();

let stopRequired = false;
let minimalScoreReached = false;

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

// Try to pair 2 players, and call recursively to create as many matches as necessary
// We take the first player, and search the best opponent (by scoring the match, and accumulating the score of the recursively generated matches)
function tryToPairPlayers(playersToPair, result, persistantData, deep)
{
    persistantData.passes++;
    deep++;

    let perf = performance.now();

    // Post log messages
    if (perf - lastPerf > 1000)
    {
        port.postMessage(persistantData);
        lastPerf = perf;
    }

    // Timeout
    if (perf - startPerf > persistantData.timeout * 1000)
    {
        if (persistantData.minScore !== +Infinity)
        {
            stopRequired = true;
        }
    }

    // Take first player from playersToPair (remove)
    let p1 = playersToPair.shift();

    let finished = false;

    let bestResult;

    let neverPlayedAnddifferentMatchPointsOpponents = [];
    let alreadyPlayedAndSameMatchPointsOpponents = [];
    let alreadyPlayedAndDifferentMatchPointsOpponents = [];

    // {
    // 	let neverPlayedOpponents = playersToPair.filter(o => p1.potentialOpponents.indexOf(o.player) !== -1);
    // 	let alreadyPlayedOpponents = playersToPair.filter(o => p1.potentialOpponents.indexOf(o.player) === -1);
    // 	let sameMatchPointsOpponnents = playersToPair.filter(o => p1.matchPoints === o.matchPoints);
    // 	let differentMatchPointsOpponnents = playersToPair.filter(o => p1.matchPoints !== o.matchPoints);
    // 	neverPlayedAndsameMatchPointsOpponents = neverPlayedOpponents.filter(o => sameMatchPointsOpponnents.indexOf(o) !== -1);
    // 	neverPlayedAnddifferentMatchPointsOpponents = neverPlayedOpponents.filter(o => differentMatchPointsOpponnents.indexOf(o) !== -1);
    // 	alreadyPlayedAndSameMatchPointsOpponents = alreadyPlayedOpponents.filter(o => sameMatchPointsOpponnents.indexOf(o) !== -1);
    // 	alreadyPlayedAndDifferentMatchPointsOpponents = alreadyPlayedOpponents.filter(o => differentMatchPointsOpponnents.indexOf(o) !== -1);
    // }

    let playersToPair2 = playersToPair;

    // Multiple passes to parse good potential opponents first
    for (let pass = 0; pass < 4; pass++)
    {
        // Parse opponents
        for (let o = 0; o < playersToPair2.length; o++)
        {
            // Take opponent[o]
            let p2 = playersToPair2[o];

            let alreadyPlayed;
            let differentMatchPoints;

            // Manage passes (compute or retrieve 'alreadyPlayed' and 'differentMatchPoints')
            if (pass === 0)
            {
                let alreadyPlayed = (p1.potentialOpponents.indexOf(p2.player) === -1);
                let differentMatchPoints = (p1.matchPoints != p2.matchPoints);

                if (!alreadyPlayed)
                {
                    if (differentMatchPoints)
                    {
                        neverPlayedAnddifferentMatchPointsOpponents.push(p2);
                        continue;
                    }
                }
                else
                {
                    if (!differentMatchPoints)
                    {
                        
                        alreadyPlayedAndSameMatchPointsOpponents.push(p2);
                    }
                    else
                    {
                        alreadyPlayedAndDifferentMatchPointsOpponents.push(p2);
                    }
                    continue;
                }
            }
            else if (pass === 1)
            {
                alreadyPlayed = false;
                differentMatchPoints = true;
            }
            else if (pass === 2)
            {
                alreadyPlayed = true;
                differentMatchPoints = false;
            }
            else if (pass === 3)
            {
                alreadyPlayed = true;
                differentMatchPoints = true;
            }

            // Scoring
            let score = 0;
            if (differentMatchPoints)
            {
                score += Math.max(p1.matchPoints, p2.matchPoints) + Math.abs(p1.matchPoints - p2.matchPoints);
            }
            if (alreadyPlayed)
            {
                score += 100 * (p1.matchPoints + p2.matchPoints);
            }
            let currentScore = result.score + score;

            if (stopRequired || minimalScoreReached || currentScore >= persistantData.minScore)
            {
                if (!persistantData.skips[deep])
                {
                    persistantData.skips[deep] = 0;
                }
                persistantData.skips[deep]++;

                continue;
            }

            let result2 = {
                "score": currentScore,
                "matches": result.matches.slice()
            };

            // Add match to matches
            let match = createMatch(false, p1.player.name, p2.player.name);
            match.score = score;
            result2.matches.push(match);

            // Copy playersToPair
            let newPlayersToPair = playersToPair.filter(p => p != p2);

            if (newPlayersToPair.length > 0)
            {
                // Recursive call for trying to pair remaining players, get matches as result
                let res = tryToPairPlayers(newPlayersToPair, result2, persistantData, deep);

                // If the next results failed, or if the result is worth
                if (!res || (bestResult && result2.score > bestResult.score))
                {
                    if (!persistantData.skips[deep])
                    {
                        persistantData.skips[deep] = 0;
                    }
                    persistantData.skips[deep]++;

                    continue;
                }

                bestResult = result2;
            }
            else // newPlayersToPair.length == 0
            {
                bestResult = result2;

                if (bestResult.score < persistantData.minScore)
                {
                    persistantData.minScore = bestResult.score;
                }

                if (currentScore == persistantData.minimalPossibleScore)
                {
                    minimalScoreReached = true;
                }
            }

            finished = true;
        }

        switch (pass)
        {
            case 0:
                // Prepare to 2nd pass
                playersToPair2 = neverPlayedAnddifferentMatchPointsOpponents;
                neverPlayedAnddifferentMatchPointsOpponents = null;
                break;
            case 1: // Prepare to 3rd path
                playersToPair2 = alreadyPlayedAndSameMatchPointsOpponents;
                alreadyPlayedAndSameMatchPointsOpponents = null;
                break;
            case 2: // Prepare to 4th pass
                playersToPair2 = alreadyPlayedAndDifferentMatchPointsOpponents;
                alreadyPlayedAndDifferentMatchPointsOpponents = null;
                break;
            default:
                break;
        }
    }

    if (finished)
    {
        result.score = bestResult.score;
        result.matches = bestResult.matches;
    }

    return finished;
}
