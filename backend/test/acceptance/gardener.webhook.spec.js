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

const _ = require('lodash')
const common = require('../support/common')
const webhookSecret = Buffer.from('webhookSecret', 'utf8').toString('hex')
const { createHubSignature } = require('../../lib/github/webhook')

describe('gardener', function () {
  describe('webhook', function () {
    /* eslint no-unused-expressions: 0 */
    let app
    const sandbox = sinon.createSandbox()

    before(function () {
      app = global.createServer()
    })

    after(function () {
      app.close()
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('should handle github webhook event "issues" action "opened"', async function () {
      const cache = common.stub.getJournalCache(sandbox)

      const githubEvent = 'issues'
      const githubIssue = {
        id: 327883527,
        comments: 0,
        created_at: '2018-06-30T20:18:32Z',
        updated_at: '2018-06-30T20:18:32Z',
        body: 'It looks like bug',
        number: 1,
        state: 'open',
        html_url: 'https://github.com/gardener/journal-dev/issues/1',
        user: {
          id: 21031061,
          avatar_url: 'https://avatars1.githubusercontent.com/u/21031061?v=4',
          login: 'johndoe'
        },
        labels: [
          {
            id: 949737505,
            name: 'bug',
            color: 'd73a4a'
          }
        ]
      }
      const body = JSON.stringify({action: 'opened', issue: githubIssue})
      let issueEvent
      cache.emitter.once('issue', event => { issueEvent = event })
      let res
      try {
        res = await chai.request(app)
          .post('/webhook')
          .set('x-github-event', githubEvent)
          .set('x-hub-signature', createHubSignature(webhookSecret, body))
          .type('application/json')
          .send(body)
      } catch (err) {
        res = err.response
      }
      expect(res).to.have.status(200)
      const issue = _.find(cache.getIssues(), ['metadata.number', 1])
      expect(issue).to.be.not.undefined
      expect(issue.data.body).to.equal(githubIssue.body)
      expect(issueEvent.object).to.eql(issue)
    })
  })
})
