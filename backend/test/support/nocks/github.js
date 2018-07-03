//
// Copyright (c) 2018 by SAP SE or an SAP affiliate company. All rights reserved. This file is licensed under the Apache Software License, v. 2 except as noted otherwise in the LICENSE file
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

'use strict'

const nock = require('nock')

const { createJournalCache } = require('../common')
// const { fromIssue } = require('../../lib/services/journals')

const webhookSecret = toHex('webhookSecret')
const url = 'https://api.github.com'
const owner = 'gardener'
const repo = 'journal-dev'
const auth = {
  token: toHex('token')
}

function toHex (secret) {
  return Buffer.from(secret, 'utf8').toString('hex')
}

function formatTime (time) {
  return new Date(time).toISOString().replace(/\.\d+Z/, 'Z')
}

/* eslint camelcase: 0 */
function createGithubIssue ({
  number,
  body,
  comments = 0,
  state = 'open',
  created_at,
  updated_at
}) {
  const issueId = 327883526 + number
  body = body || `This is bug #${number}`
  const time = (1530562712 + number * 60) * 1000
  created_at = created_at || formatTime(time)
  updated_at = updated_at || formatTime(time)
  return {
    id: issueId,
    comments,
    created_at,
    updated_at,
    body,
    number,
    state,
    html_url: `https://github.com/gardener/journal-dev/issues/${number}`,
    user: {
      id: 21031061,
      avatar_url: 'https://avatars1.githubusercontent.com/u/21031061?v=4',
      login: 'johndoe'
    },
    labels: [{
      id: 949737505,
      name: 'bug',
      color: 'd73a4a'
    }]
  }
}

function authorizationHeader (token) {
  const authorization = `token ${token}`
  return {authorization}
}

function nockWithAuthorization (token) {
  const reqheaders = authorizationHeader(token || auth.token)
  return nock(url, {reqheaders})
}

const githubIssueList = [
  createGithubIssue({number: 1}),
  createGithubIssue({number: 2, body: 'The second bug'})
]

const githubIssueCommentsList = [

]
const stub = {
  getIssues ({name, namespace, state = 'open'} = {}) {
    const q = [
      `repo:${owner}/${repo}`
    ]
    if (state) {
      q.push(`state:${state}`)
    }
    if (name && namespace) {
      q.push(`[${namespace}/${name}] in:title`)
    }
    return nockWithAuthorization(auth.token)
      .get('/search/issues')
      .query({q: q.join(' ')})
      .reply(200, {
        items: githubIssueList
      })
  }
}
module.exports = {
  url,
  auth,
  webhookSecret,
  createJournalCache,
  createGithubIssue,
  githubIssueList,
  githubIssueCommentsList,
  stub
}
