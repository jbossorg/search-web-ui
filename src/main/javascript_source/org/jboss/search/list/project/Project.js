/*
 * JBoss, Home of Professional Open Source
 * Copyright 2012 Red Hat Inc. and/or its affiliates and other contributors
 * as indicated by the @authors tag. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview
 *
 * @author Lukas Vlcek (lvlcek@redhat.com)
 */

goog.provide('org.jboss.search.list.project.Project');

goog.require('goog.object');
goog.require('goog.async.Deferred');

/**
 * Creates a new instance of Project list.
 * @param {!goog.async.Deferred} deferred source that will provide the actual data
 * @param {Function=} opt_canceller A function that will be called if the
 *     deferred is cancelled.
 * @param {Object=} opt_defaultScope The default scope to call callbacks with.
 * @constructor
 * @extends {goog.async.Deferred}
 */
org.jboss.search.list.project.Project = function(deferred, opt_canceller, opt_defaultScope) {

    goog.async.Deferred.call(this, opt_canceller, opt_defaultScope);

    /**
     * @type {!goog.async.Deferred}
     * @private
     */
    this.deferred_ = deferred;

    /**
     * @type {Object}
     * @private
     */
    this.map = {};

    // when deferred has the results, keep them in map and let the callee know.
    this.deferred_.addCallback(function(data){
        this.map = data;
        this.callback();
    }, this);
};
goog.inherits(org.jboss.search.list.project.Project, goog.async.Deferred);

/**
 * Return Project DCP ID for given DCP Project Name.
 * @param {!string} dcpProjectName
 * @return {string|null}
 */
org.jboss.search.list.project.Project.prototype.getDcpId = function(dcpProjectName) {
    if (goog.object.containsValue(this.map, dcpProjectName)) {

    }
    return "";
};

/**
 * Return DCP Project Name for given Project DCP ID.
 * @param {!string} dcpId
 * @return {!string}
 */
org.jboss.search.list.project.Project.prototype.getDcpProjectName = function(dcpId) {
    return goog.object.get(this.map, dcpId, "Unknown").valueOf();
};

/**
 * Return
 * @return {*}
 */
org.jboss.search.list.project.Project.prototype.getMap = function() {
    return this.map;
};


