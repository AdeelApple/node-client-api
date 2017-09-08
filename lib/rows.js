
/*
 * Copyright 2014-2017 MarkLogic Corporation
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
'use strict';


var requester  = require('./requester.js');
var mlutil     = require('./mlutil.js');
var Operation  = require('./operation.js');

/** @ignore */
function Rows(client) {
  this.client = client;
}

/**
 * Provides functions for performing SQL-like, relational operations
 * on indexed values and documents in the database. You define an
 * operation by constructing a plan with a {@link planBuilder}; data
 * is returned as row sets.
 * @namespace rows
 */

/**
 * Executes an execution plan built by a {@link planBuilder}. A plan
 * enables you to query data using where, groupBy, orderBy, union, join,
 * and other relationships familiar to users of SQL. You can specify that
 * results be returned in different formats.
 * @method rows#query
 * @since 2.1.1
 * @param {object} builtPlan A {@link planBuilder} object or a built
 * plan defined as a JSON object.
 * @param {object} options Options that control how the plan is executed
 * and the results returned.
 * @param {string} [options.format] The format of the returned results:
 * 'json'|'xml'|'json-seq'|'csv'|'multipart'. The default is 'json'.
 * @param {string} [options.output] How the rows sets are constructed:
 * 'object'|'array'. The default is 'object'. This option is ignored
 * for the 'xml' format or for the 'multipart' format with a rowFormat
 * of 'xml'.
 * @param {string} [options.rowFormat] The format of rows when using the
 * 'multipart' format: 'json'|'xml'. The default is 'json'.
 * @param {string} [options.columnTypes] Whether to emit column
 * data types on each row (default) or only the column name header:
 * 'rows'|'header'. The default is 'rows'.
 * @param {object} [options.bindings] The values for placeholder variables
 * within the query plan. You define them with an object whose keys are
 * the names of the variables and whose values are either primitives or
 * objects with a type or lang key and a value key.
 * @returns {ResultProvider} an object whose result() function takes
 * a {@link rows#resultList} success callback.
 */
Rows.prototype.query = function queryRows(builtPlan, options) {
  var sep = '?',
      validFormats = ['json','xml','json-seq','csv','multipart'],
      validOutputs = ['object','array'],
      validRowFormats = ['json','xml'],
      validColumnTypes = ['rows','header'],
      // set defaults
      format = 'json',
      output = 'object',
      rowFormat = 'json',
      columnTypes = 'rows'

  if (options.format !== null && options.format !== void 0) {
    if (validFormats.indexOf(options.format) >= 0) {
      format = options.format;
    } else {
      throw new Error('invalid rows format "' + options.format + '"');
    }
  }

  if (options.output !== null && options.output !== void 0) {
    if (validOutputs.indexOf(options.output) >= 0) {
      output = options.output;
    } else {
      throw new Error('invalid rows output "' + options.output + '"');
    }
  }

  if (options.rowFormat !== null && options.rowFormat !== void 0) {
    if (validRowFormats.indexOf(options.rowFormat) >= 0) {
      rowFormat = options.rowFormat;
    } else {
      throw new Error('invalid row format "' + options.rowFormat + '"');
    }
  }

  if (options.columnTypes !== null && options.columnTypes !== void 0) {
    if (validColumnTypes.indexOf(options.columnTypes) >= 0) {
      columnTypes = options.columnTypes;
    } else {
      throw new Error('invalid column types "' + options.rowFormat + '"');
    }
  }

  var endpoint = '/v1/rows';

  // Bindings handling similar to graphs#makeCommonSPARQLParams
  var bindings = null;
  if (options.bindings) {
    var bindings = options.bindings;
    var keys = Object.keys(options.bindings);
    var max = keys.length;

    var key = null;
    var obj = null;
    var type = null;
    var lang = null;
    var hasType = false;
    var hasLang = false;
    var name = null;
    var value = null;

    for (var i = 0; i < max; i++) {
      key = keys[i];
      obj = bindings[key];

      value = obj.value;
      if (value === void 0) {
        name  = key;
        value = obj;
      } else {
        type = obj.type;
        lang = obj.lang;

        hasType = (type !== null && type !== void 0);
        if (hasType) {
          if (typeof type !== 'string' && !(type instanceof String)) {
            throw new Error('type must be string');
          }
          if (type.indexOf(':') > -1) {
            throw new Error('type cannot contain colon - '+type);
          }
        }

        hasLang = (lang !== null && lang !== void 0);
        if (hasLang) {
          if (typeof lang !== 'string' && !(lang instanceof String)) {
            throw new Error('lang must be string');
          }
        }

        if (hasType && hasLang && type !== 'string') {
          throw new Error('cannot combine type with lang - '+type+' '+lang);
        } else if (hasLang) {
          name = key + '@' + lang;
        } else if (hasType) {
          name = key + ':' + type;
        } else {
          name = key;
        }
      }

      endpoint += sep+encodeURIComponent('bind:'+name)+'='+encodeURIComponent(value);
      if (i === 0 && sep === '?') { sep = '&'; }
    }
  }

  var connectionParams = this.client.connectionParams;
  var requestOptions = mlutil.copyProperties(connectionParams);
  requestOptions.method = 'POST';
  var acceptHeader = null;
  if (format === 'multipart') {
    var multipartBoundary = mlutil.multipartBoundary;
    acceptHeader = 'multipart/mixed; boundary=' + multipartBoundary;
  } else if (format === 'csv') {
    acceptHeader = 'text/csv';
  } else {
    acceptHeader = 'application/' + format;
  }
  requestOptions.headers = {
      'Content-Type': 'application/json',
      'Accept': acceptHeader
  };

  switch (format) {
    case 'multipart':
      if (rowFormat === 'xml') {
        endpoint += sep + 'row-format=' + rowFormat;
        if (sep === '?') { sep = '&'; }
      } else {
        endpoint += sep + 'output=' + output + '&row-format=' + rowFormat +
                    '&column-types=' + columnTypes;
        if (sep === '?') { sep = '&'; }
      }
      break;
    default:
      endpoint += sep + 'output=' + output + '&column-types=' + columnTypes;
      if (sep === '?') { sep = '&'; }
      break;
  }

  requestOptions.path = endpoint;

  var operation = new Operation(
        'query rows', this.client, requestOptions, 'single',
        (format === 'multipart' ? 'multipart' : 'single')
      );
  operation.validStatusCodes  = [200, 404];
  // TODO handle builtPlan as object
  operation.requestBody = builtPlan.toString();

  return requester.startRequest(operation);
}

/**
 * Returns a representation of the execution plan.
 * @method rows#explain
 * @since 2.1.1
 * @param {object} builtPlan A {@link planBuilder} object or a built
 * plan as a JSON object.
 * @param {object} options Options that control how the plan is executed
 * and the results returned.
 * @param {string} [options.format] The format of the returned
 * representation: 'json'|'xml'. The default is 'json'.
 * @returns {ResultProvider} an object whose result() function takes
 * a {@link rows#resultList} success callback.
 */
Rows.prototype.explain = function explainRows(builtPlan, options) {

  var connectionParams = this.client.connectionParams;
  var requestOptions = mlutil.copyProperties(connectionParams);
  requestOptions.method = 'POST';
  var validFormats = ['json','xml'];
  var acceptHeader = 'application/json'; // default
  if (options.format !== null && options.format !== void 0) {
    if (validFormats.indexOf(options.format) >= 0) {
      acceptHeader = 'application/' + options.format;
    } else {
      throw new Error('invalid explain format "' + options.format + '"');
    }
  }
  requestOptions.headers = {
      'Content-Type': 'application/json',
      'Accept': acceptHeader
  };

  requestOptions.path = '/v1/rows?output=explain';

  var operation = new Operation(
        'explain rows', this.client, requestOptions, 'single', 'single');
  operation.validStatusCodes  = [200, 404];
  // TODO handle builtPlan as object
  operation.requestBody = builtPlan.toString();

  return requester.startRequest(operation);
}

module.exports = Rows;