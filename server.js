const express = require('express')
const axios = require('axios')

const SERVER = 2
const LIVE = 30

let mLogMessage = []
let mActiveServer = []
let mUpdateServer = {}
let mID = null

let mUpdate = new Date().getTime()
let mStart = parseInt(mUpdate/1000)
let mTime = new Date().toString()


let BASE_URL = decode('aHR0cHM6Ly9qb2Itc2VydmVyLTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91Lw==')
let STORAGE = decode('aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9qb2Itc2VydmVyLTA4OC5hcHBzcG90LmNvbS9vLw==')

const app = express()

app.use(express.json())

app.listen(process.env.PORT || 3000, ()=>{
    consoleLog('Listening on port 3000')
})

app.get('/', async (req, res) => {
    if (mID == null) {
        try {
            let url = req.query.url
            if (!url) {
                let host = req.hostname
                if (host.endsWith('onrender.com')) {
                    url = host.replace('.onrender.com', '')
                }
            }
    
            if (url && url != 'localhost') {
                mID = url
            }
        } catch (error) {}
    }

    res.end(''+mStart)
})

app.get('/start', async (req, res) => {
    res.end(''+mTime)
})


app.get('/log', async (req, res) => {
    let msg = ''

    try {
        for (let i = 0; i < mLogMessage.length; i++) {
            try {
                msg += mLogMessage[i]+'\n'
            } catch (error) {}
        }
    } catch (error) {}

    res.end(''+msg)
})


startServer()


async function startServer() {

    await updateRender()

    await updateServer(true)

    while (true) {
        for (let i = 0; i < 5; i++) {
            await delay(60000)
            await updateStatus()

            await updateServer(false)
        }
        if (SERVER == 1) {
            await updateRender()
        }
    }
}

async function updateRender() {
    try {
        await axios.get('https://rx-server-088.onrender.com')
    } catch (error) {}
}

async function updateStatus() {
    try {
        if (mID) {
            await axios.get('https://'+mID+'.onrender.com')
        }            
    } catch (error) {}
}

async function updateServer(firstTime) {
    try {
        if (mActiveServer.length == 0 || mUpdate < new Date().getTime()) {
            let response = await axios.get(BASE_URL+'github/update/'+getServerName(SERVER)+'.json')

            try {
                let temp = []

                for(let key of Object.keys(response.data)) {
                    if (key != null) {
                        temp.push(key)
                    }
                }

                mActiveServer = temp
                mUpdate = new Date().getTime()+3600000
            } catch (error) {}
        }
        
        let size = mActiveServer.length

        if (firstTime) {
            consoleLog('All:', size, 'Load: All')
            
            for (let i = 0; i < size; i++) {
                await readLiveUpdate(mActiveServer[i])
            }
        }

        let mList = Object.keys(mUpdateServer).sort(function(a,b) { return mUpdateServer[a] - mUpdateServer[b] })
        
        let length = mList.length > LIVE ? LIVE : mList.length

        consoleLog('All:', size, 'Update:', length)

        if (length > 0) {
            let time = LIVE/length
            for (let i = 0; i < length; i++) {
                updateWebsite(i+1, mList[i], i*time*1000)
            }
        }

        if (size > 0) {
            let time = LIVE/size

            for (let i = 0; i < size; i++) {
                receiveUpdate(mActiveServer[i], i*time*1000)
            }
        }
    } catch (error) {}
}
   
async function receiveUpdate(repo, timeout) {
    setTimeout(async() => {
        await readLiveUpdate(repo)
    }, timeout)
}

async function readLiveUpdate(repo) {
    try {
        let response = await axios.get(STORAGE+encodeURIComponent('server/'+repo+'.json'))
        
        if (parseInt(new Date().getTime()/1000) > parseInt(response.data['contentType'].replace('active/', ''))+10) {
            let pervData = mUpdateServer[repo]

            if (pervData != null) {
                mUpdateServer[repo] = pervData+1
            } else {
                mUpdateServer[repo] = 1
            }
        }
    } catch (error) {}
}

async function updateWebsite(id, repo, timeout) {
    setTimeout(async() => {
        try {
            let storageUrl = STORAGE+encodeURIComponent('server/'+repo+'.json')
            let response = await axios.get(BASE_URL+'github/action/'+repo+'.json')
                
            let data = response.data

            if(data != null && data != 'null') {
                let action = data['action']
                let user = data['user']

                response = await axios.get(BASE_URL+'github/server/'+user+'.json')
            
                data = response.data

                if(data != null && data != 'null') {
                    await activeAction(id, user, repo, action, storageUrl, data['access'])
                } else {
                    consoleLog(id, 'User Not Found: '+user)
                    await axios.delete(storageUrl)
                    delete mUpdateServer[repo]
                }
            } else {
                consoleLog(id, 'Repo Not Found: '+user+'/'+repo)
                await axios.delete(storageUrl)
                delete mUpdateServer[repo]
            }
        } catch (error) {}
    }, timeout)
}

async function activeAction(id, user, repo, action, storageUrl, token) {
    try {
        let response = await axios.get(`https://api.github.com/repos/${user}/${repo}/actions/runs/${action}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github+json"
            }
        })

        let body = response.data

        if (body.status == 'completed') {
            try {
                response = await axios.post(`https://api.github.com/repos/${user}/${repo}/actions/runs/${action}/rerun`,{}, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Accept": "application/vnd.github+json"
                    }
                })

                delete mUpdateServer[repo]

                body = response.data

                try {
                    if (!body || Object.keys(body).length == 0) {
                        consoleLog(id, 'Success: '+user+'/'+repo)
                    } else {
                        consoleLog(id, 'Block: '+user+'/'+repo)
                    }

                    await axios.post(storageUrl, '', {
                        headers: {
                            'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+200)
                        },
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout:10000
                    })
                } catch (error) {}
            } catch (error) {
                console.log(error);
                
                consoleLog(id, 'Error: '+user+'/'+repo)
            }
        } else if (body.status == 'queued' || body.status == 'in_progress') {
            if (body.status == 'queued') {
                consoleLog(id, 'Panding: '+user+'/'+repo)
            } else {
                consoleLog(id, 'Runing: '+user+'/'+repo)
            }

            try {
                await axios.post(storageUrl, '', {
                    headers: {
                        'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+300)
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    timeout:10000
                })
            } catch (error) {}
            
            delete mUpdateServer[repo]
        }
    } catch (error) {}

    if (token == null) {
        consoleLog(id, 'Token Null: '+user+'/'+repo)
    }
}

function getServerName(id) {
    if (id < 10) {
        return 'server0'+id
    }
    return 'server'+id
}

function consoleLog(parm1, parm2, parm3, parm4, parm5) {
    try {
        let msg = null
        if(parm5 != undefined) {
            msg = parm1+' '+parm2+' '+parm3+' '+parm4+' '+parm5
            console.log(parm1, parm2, parm3, parm4, parm5)
        } else if(parm4 != undefined) {
            msg = parm1+' '+parm2+' '+parm3+' '+parm4
            console.log(parm1, parm2, parm3, parm4)
        } else if(parm3 != undefined) {
            msg = parm1+' '+parm2+' '+parm3
            console.log(parm1, parm2, parm3)
        } else if(parm2 != undefined) {
            msg = parm1+' '+parm2
            console.log(parm1, parm2)
        } else if (parm1 != undefined) {
            msg = parm1
            console.log(parm1)
        }

        if (msg != null) {
            mLogMessage.push(new Date().toLocaleTimeString('en-us', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '')+' :\t'+msg)

            try {
                let target = 100
                if (mLogMessage.length > target) {
                    for (let i = 0; i < mLogMessage.length - target; i++) {
                        mLogMessage.shift()
                    }
                }
            } catch (error) {}
        }
    } catch (error) {}
}

function decode(data) {
    return Buffer.from(data, 'base64').toString('ascii')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
