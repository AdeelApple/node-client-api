/*
 * Copyright 2014 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var should = require('should');

var fs = require('fs');
var concatStream = require('concat-stream');
var valcheck = require('core-util-is');

var testutil = require('./test-util.js');

var marklogic = require('../');
var q = marklogic.queryBuilder;

var db = marklogic.createDatabaseClient(testutil.restReaderConnection);
var restAdminDB = marklogic.createDatabaseClient(testutil.restAdminConnection);

describe('extension libraries', function(){
  var dbPath = '/marklogic/query/custom/directoryConstraint.xqy';
  var fsPath = './test/data/directoryConstraint.xqy';
  describe('when configuring', function() {
    it('should write the extension library', function(done){
      fs.createReadStream(fsPath).
      pipe(concatStream({encoding: 'string'}, function(source) {
        restAdminDB.config.extlibs.write(dbPath, 'application/xquery', source).
        result(function(response){
          done();
        }, done);
      }));
    });
    it('should read the extension library', function(done){
      restAdminDB.config.extlibs.read(dbPath).
      result(function(source){
        (!valcheck.isNullOrUndefined(source)).should.equal(true);
        done();
      }, done);
    });
    it('should list the extension libraries', function(done){
      restAdminDB.config.extlibs.list().
      result(function(response){
        response.assets.should.be.ok;
        response.assets.length.should.be.greaterThan(0);
        done();
      }, done);
    });
    it('should delete the extension library', function(done) {
      restAdminDB.config.extlibs.remove(dbPath).
      result(function(response){
        done();
      }, done);
    });
    // TODO: test streaming of source and list
  });

  describe('when using', function() {
    before(function(done){
      fs.createReadStream(fsPath).
      pipe(concatStream({encoding: 'string'}, function(source) {
        restAdminDB.config.extlibs.write(dbPath, 'application/xquery', source).
        result(function(response){
          done();
        }, done);
      }));
    });
    after(function(done) {
      restAdminDB.config.extlibs.remove(dbPath).
      result(function(response){
        done();
      }, done);
    });
    it('a custom constraint to parse', function(done){
      db.query(
        q.where(
          q.parsedFrom('dirs:/test/',
            q.parseBindings(
              q.queryFunction('directoryConstraint', q.bind('dirs'))
              ))
          )
        ).
      result(function(documents) {
        documents.should.be.ok;
        documents.length.should.be.greaterThan(0);
        done();
      }, done);
    });
/* TODO: custom facet constraint calculate
    console.log(response);
     */
  });
});