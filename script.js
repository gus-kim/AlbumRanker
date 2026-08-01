//DOMParser polyfill (since it doesn't work on iOS): https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
(function(DOMParser) {
    "use strict";
    var proto = DOMParser.prototype, nativeParse = proto.parseFromString;
    try {
        if ((new DOMParser()).parseFromString("", "text/html")) {
            return;
        }
    } catch (ex) {}

    proto.parseFromString = function(markup, type) {
        if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
            var
              doc = document.implementation.createHTMLDocument("")
            ;
                if (markup.toLowerCase().indexOf('<!doctype') > -1) {
                    doc.documentElement.innerHTML = markup;
                }
                else {
                    doc.body.innerHTML = markup;
                }
            return doc;
        } else {
            return nativeParse.apply(this, arguments);
        }
    };
}(DOMParser))


var flexEls = new Set(['bracket', 'results', 'intro', 'loading'])
var show = (el, val='') => el.style.display = val ? val : (flexEls.has(el.id) ? 'flex' : 'block')
var hide = (el, actualHide=false) => el.style.display = (!actualHide) ? ('none') : ('hidden')

var formDiv = document.getElementById("intro")
var albumForm = document.getElementById("album-form")
var loadingAnimation = document.getElementById("loading")
var errorMessage = document.getElementById("error-message")

var bracketDiv = document.getElementById('bracket')
var leftOption = document.getElementById("battle-left")
var rightOption = document.getElementById("battle-right")
var lr = ["battle-left", "battle-right"]

var resultsDiv = document.getElementById('results')
var resultsTable = document.getElementById('results-table')
var copyButton = document.getElementById('copy-button')

var progressText = document.getElementById('progress-text')
var progressFill = document.getElementById('progress-fill')
var undoButton = document.getElementById('undo-button')

var albumTracks = []
var albumRanking = []
var albumArtUrl = null
var equalSet = {}
var processSet = []
var processedIndex = 0
var battleHistory = []
var battleActive = false

var getEqualLength = () => Object.values(equalSet).reduce((acc, v) => acc + v.length, 0)

function updateProgress() {
    var placed = albumRanking.length + getEqualLength()
    var pct = Math.min(Math.round((placed / albumTracks.length) * 100), 99)
    progressText.textContent = pct + '%'
    progressFill.style.width = pct + '%'
}

function showError(msg) {
    errorMessage.textContent = msg
    errorMessage.classList.remove('hidden')
    setTimeout(function() { errorMessage.classList.add('hidden') }, 4000)
}

Document.prototype.createElementWithText = function(tagName, text) {
    let elem = this.createElement(tagName)
    elem.textContent = text
    return elem
}

albumForm.addEventListener('submit', function() {
    let [artist, album] = [albumForm.elements.artist.value, albumForm.elements.album.value]

    startApp(artist, album)
})

Array.from(document.getElementsByClassName('battle-option')).forEach(bo => bo.addEventListener('click', function() {
    if(!battleActive) return
    handleBattleChoice(bo.getAttribute('id'))
}))

function handleBattleChoice(id) {
    // Save state for undo
    battleHistory.push({
        ranking: albumRanking.slice(),
        equalSet: JSON.parse(JSON.stringify(equalSet)),
        processSet: processSet.slice(),
        processedIndex: processedIndex,
        left: leftOption.querySelector('.option-text').textContent,
        right: rightOption.querySelector('.option-text').textContent
    })
    undoButton.classList.remove('hidden')

    if(id == 'battle-equal') {
        processBattle(processSet, leftOption.querySelector('.option-text').textContent, rightOption.querySelector('.option-text').textContent, true)
    } else {
        var clicked = document.getElementById(id)
        var otherId = (lr.indexOf(id) == 0) ? lr[1] : lr[0]
        processBattle(processSet, clicked.querySelector('.option-text').textContent, document.getElementById(otherId).querySelector('.option-text').textContent)
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if(!battleActive || e.repeat) return
    if(e.key === 'ArrowLeft') handleBattleChoice('battle-left')
    else if(e.key === 'ArrowRight') handleBattleChoice('battle-right')
    else if(e.key === 'ArrowDown') handleBattleChoice('battle-equal')
    else if(e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoButton.click() }
})

// Undo
undoButton.addEventListener('click', function() {
    if(battleHistory.length === 0) return
    var prev = battleHistory.pop()
    albumRanking = prev.ranking
    equalSet = prev.equalSet
    processSet = prev.processSet
    processedIndex = prev.processedIndex
    setBattle(prev.left, prev.right)

    // Update progress display
    var placed = albumRanking.length + getEqualLength()
    var pct = albumTracks.length > 0 ? Math.min(Math.round((placed / albumTracks.length) * 100), 99) : 0
    progressText.textContent = pct + '%'
    progressFill.style.width = pct + '%'

    if(battleHistory.length === 0) undoButton.classList.add('hidden')
})

Array.from(document.getElementsByClassName('restart-button')).forEach(rb => rb.addEventListener('click', restart))

function setAlbumArt(url) {
    albumArtUrl = url
    Array.from(document.getElementsByClassName('album-art')).forEach(img => {
        if(url) {
            img.src = url
            img.classList.remove('hidden')
        } else {
            img.classList.add('hidden')
        }
    })
}

function restart() {
    albumTracks = []
    albumRanking = []
    albumArtUrl = null
    processedIndex = 0
    processSet = []
    equalSet = {}
    battleHistory = []
    battleActive = false
    setAlbumArt(null)

    resultsTable.innerHTML = "<tr><th>#</th><th>Track Name</th></tr>" //drop all non-header
    albumForm.reset()
    undoButton.classList.add('hidden')
    progressFill.style.width = '0%'

    hide(bracketDiv)
    hide(resultsDiv)
    show(formDiv)
}


function processBattle(cArr, winner, loser, equal=false) {
    updateProgress()
    console.log({winner: winner, loser: loser})
    console.log(["Current Array", cArr])
    if(equal) {
        if(albumRanking.length == 0) {
            albumRanking.push(winner)
            processedIndex += 1
            equalSet[winner] = [loser]
        } else {
            if(albumRanking.includes(winner)) {
                if(equalSet[winner]) {
                    equalSet[winner].push(loser)
                } else {
                    equalSet[winner] = [loser]
                }
            } else {
                if(equalSet[loser]) {
                    equalSet[loser].push(winner)
                } else {
                    equalSet[loser] = [winner]
                }
            }
        }
        processSet = []
        console.log(equalSet)
        setBattle(albumRanking[Math.floor(albumRanking.length / 2)], albumTracks[++processedIndex])
    } else {
        if(albumRanking.length < albumTracks.length+getEqualLength()) {
            console.log("I AM HERE")
            if(cArr.length > 1) {
                if(cArr.includes(loser)) {
                    if(cArr.indexOf(loser) < cArr.length - 1) {
                        processSet = cArr.slice(cArr.indexOf(loser)+1)
                        setBattle(processSet[Math.floor(processSet.length / 2)], (cArr.includes(loser)) ? (winner) : (loser))
                    } else {
                        albumRanking.splice(albumRanking.indexOf(loser)+1, 0, winner)
                        processSet = []
                        setBattle(albumRanking[Math.floor(albumRanking.length / 2)], albumTracks[++processedIndex])
                    }
                } else {
                    if(cArr.indexOf(winner) == 0) {
                        albumRanking.splice(albumRanking.indexOf(winner), 0, loser)
                        processSet = []
                        setBattle(albumRanking[Math.floor(albumRanking.length / 2)], albumTracks[++processedIndex])
                    } else {
                        processSet = cArr.slice(0, cArr.indexOf(winner))
                        setBattle(processSet[Math.floor(processSet.length / 2)], (cArr.includes(loser)) ? (winner) : (loser))
                    }
                }
            } else if(cArr.length == 1) {
                if(cArr.includes(loser)) albumRanking.splice(albumRanking.indexOf(loser) + 1, 0, winner)
                else {
                    if(albumRanking.indexOf(winner) > 0) {
                        albumRanking.splice(albumRanking.indexOf(winner), 0, loser)
                    } else {
                        albumRanking.unshift(loser)
                    }
                }

                processSet = []
                setBattle(albumRanking[Math.floor(albumRanking.length / 2)], albumTracks[++processedIndex])
            } else {
                if(albumRanking.length == 0) {
                    albumRanking.push(loser, winner)
                    processedIndex += 2
                    setBattle(albumRanking[1], albumTracks[processedIndex])
                } else if(albumRanking.length == 1) {
                    if(albumRanking.includes(winner)) {
                        albumRanking.splice(albumRanking.indexOf(winner), 0, loser)
                    } else {
                        albumRanking.push(winner)
                    }

                    processSet = []
                    setBattle(albumRanking[Math.floor(albumRanking.length / 2)], albumTracks[++processedIndex])
                } else if(albumRanking.length == 2) {
                    if(albumRanking.includes(winner)) {
                        albumRanking.splice(1, 0, loser)
                    } else {
                        albumRanking.push(winner)
                    }
                    processSet = []
                    setBattle(albumRanking[Math.floor(albumRanking.length / 2)], albumTracks[++processedIndex])
                } else {
                    if(processSet.length == 0) {
                        if(albumRanking.includes(winner)) {
                            processSet = albumRanking.slice(0, albumRanking.indexOf(winner))
                        } else {
                            processSet = albumRanking.slice(albumRanking.indexOf(loser) + 1)
                        }
                    } else {
                        if(processSet.includes(winner)) {
                            processSet = cArr.slice(0, cArr.indexOf(winner))
                        } else {
                            processSet = cArr.slice(cArr.indexOf(loser) + 1)
                        }
                    }
                    setBattle(processSet[Math.floor(processSet.length / 2)], albumTracks[processedIndex])
                }
            }

        }
    }
    console.log({equalRanking: equalSet, equalLength: getEqualLength(), ranking: albumRanking, rankingLength: albumRanking.length})

    let totalLength = getEqualLength() + albumRanking.length

    if(totalLength == albumTracks.length) {
        battleActive = false
        progressFill.style.width = '100%'
        progressText.textContent = '100%'
        setBattle("--", "--")
        showResults()
    }
}

function showResults() {
    let ranking = albumRanking.reverse()
    let modRanking = []
    for(let i = 0; i < ranking.length; i++) {
        modRanking.push({name: ranking[i], rank: i+1})
        if(ranking[i] in equalSet) equalSet[ranking[i]].map(x => [{name: x, rank: i+1}]).forEach(es => modRanking.push(es[0]))
    }
    console.log(modRanking)

    function createSongRow(st, i) {
        let tr = document.createElement("tr")

        let trackRank = document.createElement("td")
        trackRank.textContent = i
        let trackName = document.createElement("td")
        trackName.textContent = st
        tr.appendChild(trackRank)
        tr.appendChild(trackName)
        return tr
    }

    modRanking.forEach(mr => resultsTable.appendChild(createSongRow(mr.name, mr.rank)))
    hide(bracketDiv)
    hide(formDiv)
    show(resultsDiv)
}


async function getAlbumArt(artist, album) {
    try {
        const query = encodeURIComponent(`${artist} ${album}`)
        const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=album&limit=5`)
        const data = await response.json()
        if(data.results && data.results.length > 0) {
            return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb')
        }
    } catch(e) {
        console.log('Album art fetch failed:', e)
    }
    return null
}

async function getAlbumTracks(artist, album) {
    //probably shouldn't use cors-anywhere but idk why it ain't working from ghp
    for(let conf of [{ splitApostrophes: false }, { splitApostrophes: true }]) {
        try {
            const response = await fetch(`https://dork.nathansbud-cors.workers.dev/?https://genius.com/albums/${geniusClean(artist)}/${geniusClean(album, conf)}`)
            const body = await response.text()

            const pageContent = new DOMParser().parseFromString(body, 'text/html')
            const className = (pageContent.getElementsByClassName("chart_row-content-title").length > 0) ? ("chart_row-content-title") : ("tracklist_row-header-content-title")
            const tracks = Array.from(pageContent.getElementsByClassName(className)).map(t => t.textContent.trim().slice(0, -1*("Lyrics").length).trim())
            console.log(`Tracks: ${tracks}`)
            return tracks
        } catch(e) {
            console.log(e)
        }
    }

    return []
}

function setBattle(left, right) {
    leftOption.querySelector('.option-text').textContent = left
    rightOption.querySelector('.option-text').textContent = right
}


async function startApp(artist, album) {
    if(artist && album) {
        errorMessage.classList.add('hidden')
        show(loadingAnimation)
        for(let an of document.getElementsByClassName("album-name")) an.textContent = album

        const [tracks, artUrl] = await Promise.all([
            getAlbumTracks(artist, album),
            getAlbumArt(artist, album)
        ])

        albumTracks = tracks
        hide(loadingAnimation)

        if(albumTracks.length > 1) {
            setAlbumArt(artUrl)
            document.getElementById("battle-tracks").textContent = albumTracks.join(", ")
            albumTracks = shuffle(albumTracks)

            battleActive = true
            progressText.textContent = '0%'
            progressFill.style.width = '0%'

            setBattle(albumTracks[0], albumTracks[1])

            hide(formDiv)
            show(bracketDiv)
        } else if(albumTracks.length == 1) {
            setAlbumArt(artUrl)
            albumRanking = albumTracks
            showResults()
        } else {
            showError('Album "' + album + '" by ' + artist + ' not found on Genius.')
        }
    }
}

function geniusClean(fi, config={splitApostrophes: false}) {
    let splitSet = ["ft.", "feat.", "featuring.", "(with"]
    let replaceSet = {"&":"and", "•":"", "æ":"", "œ":""}

    // Address bug from random Instagram user
    if(config.splitApostrophes) {
        replaceSet["'"] = ""
    }

    Object.entries(replaceSet).forEach(([k, v]) => fi = fi.replace(k, v))
    splitSet.forEach(ss => fi = fi.split(` ${ss} `)[0])

    fi = fi.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                .replace(/[^a-zA-Z0-9]/g, "-")
                                .replace(/[-]+/g, "-")
                                .replace(/(^-)|(-$)/, "")

    return fi.charAt(0).toUpperCase() + fi.slice(1).toLowerCase()
}

//https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(arr) {
    let currentIndex = arr.length, randIndex, temp
    while(0 !== currentIndex) {
        randIndex = Math.floor(Math.random()*currentIndex)
        currentIndex -= 1

        temp = arr[randIndex]
        arr[randIndex] = arr[currentIndex]
        arr[currentIndex] = temp
    }
    return arr
}

//html2canvas trick: https://stackoverflow.com/questions/41440762/copy-div-with-mixed-content-as-image-to-clipboard
//iframe trick: https://ourcodeworld.com/articles/read/682/what-does-the-not-allowed-to-navigate-top-frame-to-data-url-javascript-exception-means-in-google-chrome

copyButton.addEventListener('click', function() {
    var shareCard = document.getElementById('share-card')
    var shareArt = document.getElementById('share-art')
    var shareAlbum = document.getElementById('share-album-name')
    var shareArtist = document.getElementById('share-artist-name')
    var shareList = document.getElementById('share-tracklist')

    var albumName = document.querySelector('.album-name').textContent
    var artistName = albumForm.elements.artist.value

    shareAlbum.textContent = albumName
    shareArtist.textContent = artistName

    shareList.innerHTML = ''
    Array.from(resultsTable.querySelectorAll('tr')).slice(1).forEach(function(row) {
        var cells = row.querySelectorAll('td')
        if(cells.length < 2) return
        var li = document.createElement('li')
        var rank = document.createElement('span')
        rank.className = 'srank'
        rank.textContent = cells[0].textContent + '. '
        var name = document.createTextNode(cells[1].textContent)
        li.appendChild(rank)
        li.appendChild(name)
        shareList.appendChild(li)
    })

    function renderCanvas() {
        html2canvas(shareCard, { backgroundColor: '#eeeeee', scale: 3, useCORS: true }).then(function(canvas) {
            var filename = albumName.replace(/[^a-z0-9]/gi, '_') + '_ranking.png'
            if(navigator.share && navigator.canShare) {
                canvas.toBlob(function(blob) {
                    var file = new File([blob], filename, { type: 'image/png' })
                    if(navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file] }).catch(function() {})
                    } else {
                        window.open(canvas.toDataURL('image/png'))
                    }
                })
            } else {
                var link = document.createElement('a')
                link.download = filename
                link.href = canvas.toDataURL('image/png')
                link.click()
            }
        })
    }

    if(albumArtUrl) {
        var img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = function() {
            var c = document.createElement('canvas')
            c.width = img.width; c.height = img.height
            c.getContext('2d').drawImage(img, 0, 0)
            shareArt.src = c.toDataURL()
            shareArt.classList.remove('hidden')
            renderCanvas()
        }
        img.onerror = function() {
            shareArt.classList.add('hidden')
            renderCanvas()
        }
        img.src = albumArtUrl
    } else {
        shareArt.src = ''
        shareArt.classList.add('hidden')
        renderCanvas()
    }
})
