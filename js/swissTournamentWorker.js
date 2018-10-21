let MatchState =
{
    Pending: 0,
    Finished: 1,
    Bye: 2
};

function createMatch(playerId, opponentId)
{
    let match = newObject();
    match.roundNotFinished = 0;
    match.p1 = (playerId >= 0 ? playerId : -1);
    match.p2 = (opponentId >= 0 ? opponentId : -1);
    return match;
}

// Objects pool

let objectsPool = [];
let objectsCount = 0;

function newObject()
{
    let object;

    if (objectsPool.length > 0)
    {
        object = objectsPool.pop();
    }
    else
    {
        object = {};
        objectsCount++;
    }

    return object;
}

function deleteObject(object)
{
    for (var member in object)
    {
        delete object[member];
    }
    objectsPool.push(object);
}

// Arrays pool

let arraysPool = [];
let arraysCount = 0;

function newArray(length)
{
    let array;

    if (arraysPool.length > 0)
    {
        array = arraysPool.pop();
    }
    else
    {
        array = [];
        arraysCount++;
    }

    if (length > 0)
    {
        array.length = length;
    }

    return array;
}

function deleteArray(array)
{
    array.length = 0;
    arraysPool.push(array);
}

function copyArray(from, to)
{
    to.length = from.length;
    for (let i = 0; i < from.length; i++)
    {
        to[i] = from[i];
    }
}

// Init webworker

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
        if (result && result.matches)
        {
            result.matches.forEach(match => {
                match.state = MatchState.Pending;
                match.score1 = 0;
                match.score2 = 0;
            });
        }
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

// Init global variables

let startPerf = performance.now();
let lastPerf = performance.now();

let stopRequired = false;
let minimalScoreReached = false;

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
        persistantData.objectsCount = objectsCount;
        persistantData.arraysCount = arraysCount;
        persistantData.computingTime = perf;
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

    let neverPlayedAnddifferentMatchPointsOpponents = newArray();
    let alreadyPlayedAndSameMatchPointsOpponents = newArray();
    let alreadyPlayedAndDifferentMatchPointsOpponents = newArray();

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
                alreadyPlayed = (p1.alreadyPlayedOpponents.indexOf(p2.id) !== -1);
                differentMatchPoints = (p1.matchPoints != p2.matchPoints);

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

            if (stopRequired || minimalScoreReached || currentScore >= persistantData.minScore || persistantData.onlyPerfect && score > persistantData.minimalPossibleScore.byMatch[deep])
            {
                if (!persistantData.skips[deep])
                {
                    persistantData.skips[deep] = 0;
                }
                persistantData.skips[deep]++;

                continue;
            }

            let result2 = newObject();
            result2.score = currentScore;
            result2.matches = newArray(result.matches.length);
            copyArray(result.matches, result2.matches);

            // Add match to matches
            let match = createMatch(p1.id, p2.id);
            result2.matches.push(match);

            // Copy playersToPair
            let newPlayersToPair = newArray();
            copyArray(playersToPair, newPlayersToPair);
            let p2Index = playersToPair.indexOf(p2);
            newPlayersToPair.splice(p2Index, 1);

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

                    for (var i = result.matches.length; i < result2.matches.length; i++)
                    {
                        deleteObject(result2.matches[i]);
                    }
                    deleteArray(result2.matches);
                    deleteObject(result2);
                    result2 = null;
                    deleteArray(newPlayersToPair);
                    continue;
                }

                if (bestResult)
                {
                    for (var i = result.matches.length; i < result2.matches.length; i++)
                    {
                        deleteObject(bestResult.matches[i]);
                    }
                    deleteArray(bestResult.matches);
                    deleteObject(bestResult);
                    bestResult = null;
                }
                bestResult = result2;
            }
            else // newPlayersToPair.length == 0
            {
                if (bestResult)
                {
                    for (var i = result.matches.length; i < result2.matches.length; i++)
                    {
                        deleteObject(bestResult.matches[i]);
                    }
                    deleteArray(bestResult.matches);
                    deleteObject(bestResult);
                    bestResult = null;
                }
                bestResult = result2;

                if (bestResult.score < persistantData.minScore)
                {
                    persistantData.minScore = bestResult.score;
                    port.postMessage(persistantData);
                }

                if (currentScore == persistantData.minimalPossibleScore.total)
                {
                    minimalScoreReached = true;
                }
            }

            deleteArray(newPlayersToPair);

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
                deleteArray(playersToPair2);
                playersToPair2 = alreadyPlayedAndSameMatchPointsOpponents;
                alreadyPlayedAndSameMatchPointsOpponents = null;
                break;
            case 2: // Prepare to 4th pass
                deleteArray(playersToPair2);
                playersToPair2 = alreadyPlayedAndDifferentMatchPointsOpponents;
                alreadyPlayedAndDifferentMatchPointsOpponents = null;
                break;
            default:
                deleteArray(playersToPair2);
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
