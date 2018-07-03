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
const { createHubSignature } = require('../../lib/github/webhook')
const { loadOpenIssues } = require('../../lib/services/journals')
const { webhookSecret, createGithubIssue } = nocks.github

describe('gardener', function () {
  describe('webhook', function () {
    /* eslint no-unused-expressions: 0 */
    let app
    let cache
    const sandbox = sinon.createSandbox()

    before(function () {
      app = global.createServer()
    })

    after(function () {
      app.close()
    })

    beforeEach(async function () {
      cache = common.stub.getJournalCache(sandbox)
      nocks.github.stub.getIssues({state: 'open'})
      await loadOpenIssues()
    })

    afterEach(function () {
      nocks.verify()
      nocks.reset()
      sandbox.restore()
    })

    it('should search for all open issues', async function () {
      expect(cache.getIssues()).to.have.length(2)
    })

    it('should handle github webhook event "issues" action "opened"', async function () {
      const githubEvent = 'issues'
      const githubIssueNumber = 42
      const githubIssue = createGithubIssue({number: githubIssueNumber})
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
      const issues = cache.getIssues()
      expect(issues).to.have.length(3)
      const issue = _.find(issues, ['metadata.number', githubIssueNumber])
      expect(issue).to.be.not.undefined
      expect(issue.data.body).to.equal(githubIssue.body)
      expect(issueEvent.object).to.eql(issue)
    })
  })
})
