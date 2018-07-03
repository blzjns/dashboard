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
const { createHmac, timingSafeEqual } = require('crypto')
const config = require('../../config')
const logger = require('../../logger')
const { InternalServerError, Forbidden } = require('../../errors')
const { fromIssue, fromComment, loadIssueComments } = require('../../services/journals')
const { getJournalCache } = require('../../cache')

const hubSignatureAlgorithm = Buffer.from('73686131', 'hex').toString('ascii')

function verifyHubSignature (req, res, body) {
  const webhookSecret = _.get(config, 'gitHub.webhookSecret')
  if (!webhookSecret) {
    throw new InternalServerError('Property \'gitHub.webhookSecret\' not configured on dashboard backend')
  }
  const requestSignature = req.headers['x-hub-signature']
  if (!requestSignature) {
    throw new Forbidden('Header \'x-hub-signature\' not provided')
  }
  const signature = createHubSignature(webhookSecret, body)
  if (!digestsEqual(requestSignature, signature)) {
    throw new Forbidden('Signatures didn\'t match!')
  }
}
exports.verifyHubSignature = verifyHubSignature

function handleGithubEvent (req, res, next) {
  try {
    const event = req.headers['x-github-event']
    const { action, issue, comment } = req.body
    switch (event) {
      case 'issues':
        handleIssue({action, issue})
        break
      case 'issue_comment':
        handleComment({action, issue, comment})
        break
      default:
        logger.error(`Unhandled event: ${event}`)
    }
    res.end()
  } catch (err) {
    next(err)
  }
}
exports.handleGithubEvent = handleGithubEvent

function handleIssue ({action, issue}) {
  const cache = getJournalCache()
  issue = fromIssue(issue)

  if (action === 'closed') {
    cache.removeIssue({issue})
    return
  }
  cache.addOrUpdateIssue({issue})

  if (action === 'reopened') {
    process.nextTick(() => updateCommentsForIssue({issue}))
  }
}
exports.handleIssue = handleIssue

function updateCommentsForIssue ({issue}) {
  const {
    data: {
      comments: numberOfComments = 0
    } = {},
    metadata: {
      number
    } = {}
  } = issue
  if (numberOfComments > 0) {
    return loadIssueComments({number})
      .catch(err => {
        logger.error('failed to fetch comments for reopened issue %s: %s', number, err)
      })
  }
}

function handleComment ({action, issue, comment}) {
  const cache = getJournalCache()
  const {
    metadata: {namespace, name, number: issueNumber} = {}
  } = issue = fromIssue(issue) || {}
  comment = fromComment(issueNumber, name, namespace, comment)

  cache.addOrUpdateIssue({issue})

  if (action === 'deleted') {
    cache.removeComment({issueNumber, comment})
    return
  }
  cache.addOrUpdateComment({issueNumber, comment})
}
exports.handleComment = handleComment

function digestsEqual (a, b) {
  if (!Buffer.isBuffer(a)) {
    a = Buffer.from(a, 'ascii')
  }
  if (!Buffer.isBuffer(b)) {
    b = Buffer.from(b, 'ascii')
  }
  return a.length === b.length && timingSafeEqual(a, b)
}
exports.digestsEqual = digestsEqual

function createHubSignature (secret, value) {
  return `${hubSignatureAlgorithm}=${createHmac('sha1', secret).update(value).digest('hex')}`
}
exports.createHubSignature = createHubSignature
