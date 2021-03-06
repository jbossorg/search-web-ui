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
 * @fileoverview The main search page.
 *
 * @author lvlcek@redhat.com (Lukas Vlcek)
 * @suppress {deprecated}
 */

goog.provide('org.jboss.search.page.SearchPage');

goog.require('goog.Uri');
goog.require('goog.array');
goog.require('goog.async.Delay');
goog.require('goog.debug.Logger');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('goog.events.EventType');
goog.require('goog.events.Key');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyEvent');
goog.require('goog.net.EventType');
goog.require('goog.net.XhrManager');
goog.require('goog.object');
goog.require('goog.string');
goog.require('org.jboss.core.Constants');
goog.require('org.jboss.core.context.RequestParams');
goog.require('org.jboss.core.context.RequestParams.Order');
goog.require('org.jboss.core.context.RequestParamsFactory');
goog.require('org.jboss.core.service.Locator');
goog.require('org.jboss.core.service.query.QueryServiceDispatcher');
goog.require('org.jboss.core.service.query.QueryServiceEvent');
goog.require('org.jboss.core.service.query.QueryServiceEventType');
goog.require('org.jboss.core.util.urlGenerator');
goog.require('org.jboss.core.visualization.HistogramEventType');
goog.require('org.jboss.core.visualization.IntervalSelected');
goog.require('org.jboss.search.Constants');
goog.require('org.jboss.search.Variables');
goog.require('org.jboss.search.page.SearchPageElements');
goog.require('org.jboss.search.page.UserIdle');
goog.require('org.jboss.search.page.element.SearchFieldHandler');
goog.require('org.jboss.search.page.event.ContributorIdSelected');
goog.require('org.jboss.search.page.event.QuerySubmitted');
goog.require('org.jboss.search.page.filter.AuthorFilter');
goog.require('org.jboss.search.page.filter.ContentFilter');
goog.require('org.jboss.search.page.filter.DateFilter');
goog.require('org.jboss.search.page.filter.DateFilterEventType');
goog.require('org.jboss.search.page.filter.DateOrderByChanged');
goog.require('org.jboss.search.page.filter.DateRangeChanged');
goog.require('org.jboss.search.page.filter.NewRequestParamsEvent');
goog.require('org.jboss.search.page.filter.NewRequestParamsEventType');
goog.require('org.jboss.search.page.filter.TechnologyFilter');
goog.require('org.jboss.search.page.templates');
goog.require('org.jboss.search.request');
goog.require('org.jboss.search.response');
goog.require('org.jboss.search.suggestions.event.EventType');
goog.require('org.jboss.search.suggestions.query.view.View');
goog.require('org.jboss.search.util.searchFilterGenerator');



/**
 * @param {EventTarget|goog.events.EventTarget} context element to catch click events and control behaviour of the UI.
 *        Typically, this is the document.
 * @param {{
 *    authorElements: !org.jboss.search.page.filter.CommonFilterElements,
 *    technologyElements: !org.jboss.search.page.filter.CommonFilterElements,
 *    contentElements: !org.jboss.search.page.filter.ContentFilterElements,
 *    dateElements: !org.jboss.search.page.filter.DateFilterElements,
 *    searchPageElements: !org.jboss.search.page.SearchPageElements
 * }} params
 * @constructor
 * @extends {goog.events.EventTarget}
 */
org.jboss.search.page.SearchPage = function(context, params) {

  goog.events.EventTarget.call(this);

  /**
   * @type {goog.debug.Logger|goog.log.Logger|!goog.debug.Logger}
   * @private
   */
  this.log_ = goog.debug.Logger.getLogger('org.jboss.search.page.SearchPage');

  /**
   * @type {!org.jboss.search.page.SearchPageElements}
   * @private
   */
  this.elements_ = params.searchPageElements;

  /**
   * @type {!org.jboss.search.page.filter.CommonFilterElements}
   * @private
   */
  this.authorFilterElements_ = params.authorElements;

  /**
   * @type {!org.jboss.search.page.filter.CommonFilterElements}
   * @private
   */
  this.technologyFilterElements_ = params.technologyElements;

  /**
   * @type {!org.jboss.search.page.filter.ContentFilterElements}
   * @private
   */
  this.contentFilterElements_ = params.contentElements;

  /**
   * @type {!org.jboss.search.page.filter.DateFilterElements}
   * @private
   */
  this.dateFilterElements_ = params.dateElements;

  /**
   * @private
   * @type {!goog.net.XhrManager} */
  this.xhrManager_ = org.jboss.core.service.Locator.getInstance().getLookup().getXhrManager();

  /** @private */
  this.context_ = context;

  /** @private */
  this.query_suggestions_view_ = new org.jboss.search.suggestions.query.view.View(
      this.elements_.getQuery_suggestions_div()
      );
  /** @private */
  this.query_suggestions_model_ = {};

  /**
   * @type {!org.jboss.core.service.query.QueryServiceDispatcher}
   * @private
   */
  this.queryServiceDispatcher_ = org.jboss.core.service.Locator.getInstance().getLookup().getQueryServiceDispatcher();

  /**
   * Listener ID, this listener handles events for user query (the query based on text from main search field).
   * @type {goog.events.Key}
   * @private
   */
  this.userQueryServiceDispatcherListenerId_ = goog.events.listen(
      this.queryServiceDispatcher_,
      [
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_START,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_ABORTED,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_FINISHED,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUCCEEDED,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_ERROR
      ],
      goog.bind(function(e) {
        var metadata_;
        var event = /** @type {org.jboss.core.service.query.QueryServiceEvent} */ (e);
        switch (event.type) {
          /*
           =====================================================
           As soon as user query is started we update couple of HTML elements:
           - user query field
           - date filter: from date field
           - date filter: to date field
           - date filter: order box
           =====================================================
           */
          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_START:
            metadata_ = event.getMetadata();
            /** @type {org.jboss.core.context.RequestParams} */
            var requestParams_ = metadata_['requestParams'];
            this.log_.info('Search request for [' + requestParams_.getQueryString() + '] started. URL: [' +
                metadata_['url'] + ']');
            this.setUserQuery_(requestParams_.getQueryString());
            this.disableSearchResults_();
            // update date filter fields in date filter
            var filter = org.jboss.core.service.Locator.getInstance().getLookup().getDateFilter();
            if (goog.isDefAndNotNull(filter)) {
              var from_ = requestParams_.getFrom();
              var to_ = requestParams_.getTo();
              filter.setFromValue(goog.isDefAndNotNull(from_) ? from_ : null);
              filter.setToValue(goog.isDefAndNotNull(to_) ? to_ : null);
              filter.setOrder(requestParams_.getOrder());
            }
            break;

          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_ABORTED:
            this.log_.fine('Search request aborted');
            this.enableSearchResults_();
            break;

          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_FINISHED:
            this.log_.info('Search request finished');
            this.disposeUserEntertainment_();
            break;

          /*
           =====================================================
           When new search results are available:
           - render HTML and display it.
           =====================================================
           */
          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUCCEEDED:
            try {
              var response = /** @type {org.jboss.core.response.SearchResults} */ (event.getMetadata());
              // this.log_.info('Search request succeeded, took ' + response['took'] + 'ms, uuid [' +
              //   response['uuid'] + ']');

              var queryKey = response.query.toString();
              if (goog.isDefAndNotNull(queryKey) && !goog.string.isEmpty(queryKey)) {
                this.renderSearchResults_();
              } else {
                this.clearSearchResults();
              }
              this.enableSearchResults_();

              // TODO: can this be removed? It should be moved to the filter itself (see Technology or Content filter)
              // refresh histogram chart only if filter is expanded (i.e. visible)
              var dateFilter_ = org.jboss.core.service.Locator.getInstance().getLookup().getDateFilter();
              if (goog.isDefAndNotNull(dateFilter_)) {
                dateFilter_.refreshChart(false);
              }

            } catch (err) {
              // TODO: dispatch application error
              // console.log(err);
            }
            break;

          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_ERROR:
            this.log_.info('Search request error');
            org.jboss.core.service.Locator.getInstance().getLookup().setRecentQueryResultData(null);
            metadata_ = event.getMetadata();
            this.renderQueryResponseError_(metadata_['query_string'], metadata_['error']);
            this.enableSearchResults_();
            break;

          default:
            this.log_.info('Unknown search event type [' + event.type + ']');
        }
      }, this)
      );

  /**
   * Listener ID, this listener handles events for user query suggestions.
   * @type {goog.events.Key}
   * @private
   */
  this.userSuggestionsQueryServiceDispatcherListenerId_ = goog.events.listen(
      this.queryServiceDispatcher_,
      [
        // org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_START,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_ABORTED,
        // org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_FINISHED,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_SUCCEEDED,
        org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_ERROR
      ],
      goog.bind(function(e) {
        var event = /** @type {org.jboss.core.service.query.QueryServiceEvent} */ (e);
        switch (event.type) {

          // case org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_START:
          // break;

          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_ABORTED:
            this.hideAndCleanSuggestionsElementAndModel_();
            break;

          // case org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_FINISHED:
          // break;

          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_SUCCEEDED:
            var response = /** @type {!Object} */ (event.getMetadata());
            var model = /** @type {!Object} */ (goog.object.get(response, 'model', {}));
            this.query_suggestions_model_ = this.parseQuerySuggestionsModel_(model);

            if (goog.object.containsKey(response, 'view')) {
              var view = /** @type {!Object} */ (goog.object.get(response, 'view', {}));

              this.query_suggestions_view_.update(view);
              this.query_suggestions_view_.show();

            } else {
              this.hideAndCleanSuggestionsElementAndModel_();
            }
            break;

          case org.jboss.core.service.query.QueryServiceEventType.SEARCH_SUGGESTIONS_ERROR:
            this.hideAndCleanSuggestionsElementAndModel_();
            break;

          default:
            this.log_.info('Unknown search suggestions event type [' + event.type + ']');
        }
      }, this)
      );

  /**
   * Listener ID, this listener is invoked when date filter interval is changed.
   * Client needs to remember that this listener can be initiated only after the date filter has been instantiated!
   * @type {goog.events.Key}
   * @private
   */
  this.dateFilterIntervalSelectedId_;

  /**
   * Listener ID, this listener is invoked when date orderBy value is changed.
   * Client needs to remember that this listener can be initiated only after the date filter has been instantiated!
   * @type {goog.events.Key}
   * @private
   */
  this.dateOrderByChangedId_;

  /**
   * Listener ID, this listener is invoked when selected date range is changed. I.e. FROM or TO or both dates changes.
   * Client needs to remember that this listener can be initiated only after the date filter has been instantiated!
   * @type {goog.events.Key}
   * @private
   */
  this.dateRangeChangedId_;

  /**
   * This listener is called whenever a new {@link RequestParams} is dispatched from technology filter.
   * @type {goog.events.Key}
   * @private
   */
  this.newRequestParamsFromTechnologyFilterKey_;

  /**
   * This listener is called whenever a new {@link RequestParams} is dispatched from content filter.
   * @type {goog.events.Key}
   * @private
   */
  this.newRequestParamsFromContentFilterKey_;

  /**
   * This listener is called whenever a new {@link RequestParams} is dispatched from author filter.
   * @type {goog.events.Key}
   * @private
   */
  this.newRequestParamsFromAuthorFilterKey_;

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.xhrReadyListenerId_ = goog.events.listen(this.xhrManager_, goog.net.EventType.READY, goog.bind(function() {
    this.dispatchEvent(org.jboss.search.suggestions.event.EventType.SEARCH_START);
  }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.xhrCompleteListenerId_ = goog.events.listen(this.xhrManager_, goog.net.EventType.COMPLETE, goog.bind(function() {
    this.dispatchEvent(org.jboss.search.suggestions.event.EventType.SEARCH_FINISH);
  }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.xhrErrorListenerId_ = goog.events.listen(this.xhrManager_, goog.net.EventType.ERROR, goog.bind(function() {
    this.dispatchEvent(org.jboss.search.suggestions.event.EventType.SEARCH_FINISH);
  }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.xhrAbortListenerId_ = goog.events.listen(this.xhrManager_, goog.net.EventType.ABORT, goog.bind(function() {
    this.dispatchEvent(org.jboss.search.suggestions.event.EventType.SEARCH_FINISH);
  }, this));

  this.query_suggestions_view_.setClickCallbackFunction(
      goog.bind(function() {
        var selectedIndex = this.query_suggestions_view_.getSelectedIndex();
        this.hideAndCleanSuggestionsElementAndModel_();
        this.elements_.getQuery_field().focus();
        this.dispatchEvent(
            new org.jboss.search.page.event.QuerySubmitted(
                org.jboss.core.context.RequestParamsFactory.getInstance()
                    .reset()
                    .setQueryString('option was selected by pointer (index: ' + selectedIndex + ')')
                    .build()
            )
        );
      }, this)
  );

  var suggestionsCallback = function(query_string) {
    org.jboss.core.service.Locator.getInstance().getLookup()
      .getQueryService()
      .userSuggestionQuery(query_string);
  };

  var instantSearch = function(query_string) {
    var q = goog.isDefAndNotNull(query_string) ? goog.string.collapseWhitespace(query_string) : '';
    /** @type {?org.jboss.core.context.RequestParams} */
    var rp = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
    var tmp_ = rp.getQueryString();
    var oldq = goog.isNull(tmp_) ? '' : goog.string.collapseWhitespace(tmp_);
    if (oldq != q) {
      //
      if (!goog.string.isEmptySafe(query_string) && goog.string.endsWith(query_string, ' ')) {
        q += ' ';
      }
      this.dispatchEvent(
          new org.jboss.search.page.event.QuerySubmitted(
              org.jboss.core.context.RequestParamsFactory.getInstance()
                .reset()
                .setQueryString(q)
                .build()
          ));
    }
  };

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.dateClickListenerId_ = goog.events.listen(
      this.dateFilterElements_.getTabElement(),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        this.isDateFilterExpanded_() ? this.collapseDateFilter_() : this.expandDateFilter_();
      }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.projectClickListenerId_ = goog.events.listen(
      this.technologyFilterElements_.getTabElement(),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        this.isTechnologyFilterExpanded_() ? this.collapseTechnologyFilter_() : this.expandTechnologyFilter_();
      }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.authorClickListenerId_ = goog.events.listen(
      this.authorFilterElements_.getTabElement(),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        this.isAuthorFilterExpanded_() ? this.collapseAuthorFilter_() : this.expandAuthorFilter_();
      }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.contentClickListenerId_ = goog.events.listen(
      this.contentFilterElements_.getTabElement(),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        this.isContentFilterExpanded_() ? this.collapseContentFilter_() : this.expandContentFilter_();
      }, this));

  /**
   * @type {goog.events.Key}
   * @private
   */
  this.contextClickListenerId_ = goog.events.listen(
      this.context_,
      goog.events.EventType.CLICK,
      goog.bind(function(event) {
        var e = /** @type {goog.events.Event} */ (event);
        // this.log_.info("Context clicked: " + goog.debug.expose(e));

        // if search field is clicked then do not hide search suggestions
        if (e.target !== this.elements_.getQuery_field()) {
          this.hideAndCleanSuggestionsElementAndModel_();
        }

        // if date filter (sub)element is clicked do not hide date filter
        if (e.target !== this.dateFilterElements_.getTabElement() &&
            !goog.dom.contains(this.dateFilterElements_.getHostingElement(), /** @type {Node} */ (e.target))) {
          this.collapseDateFilter_();
        }

        // if technology filter (sub)element is clicked do not hide technology filter
        if (e.target !== this.technologyFilterElements_.getTabElement() &&
            !goog.dom.contains(this.technologyFilterElements_.getHostingElement(), /** @type {Node} */ (e.target))) {
          this.collapseTechnologyFilter_();
        }

        // if author filter (sub)element is clicked do not hide author filter
        if (e.target !== this.authorFilterElements_.getTabElement() &&
            !goog.dom.contains(this.authorFilterElements_.getHostingElement(), /** @type {Node} */ (e.target))) {
          this.collapseAuthorFilter_();
        }

        // if content filter (sub)element is clicked do not hide content filter
        if (e.target !== this.contentFilterElements_.getTabElement() &&
            !goog.dom.contains(this.contentFilterElements_.getHostingElement(), /** @type {Node} */ (e.target))) {
          this.collapseContentFilter_();
        }
      }, this));

  /**
   * This listener can catch events when the user navigates to the query field by other means then clicking,
   * for example by TAB key or by selecting text in the field by cursor (does not fire click event).
   * We want to hide filter tabs in such case.
   * @type {goog.events.Key}
   * @private
   */
  this.query_field_focus_id_ = goog.events.listen(
      this.elements_.getQuery_field(),
      goog.events.EventType.INPUT,
      goog.bind(function() {
        this.collapseAllFilters_();
      }, this));

  /** @private */
  this.userQuerySearchField_ = new org.jboss.search.page.element.SearchFieldHandler(
      this.elements_.getQuery_field(),
      500, // 100,
      goog.bind(instantSearch, this), //suggestionsCallback,
      null,
      this.getPresetKeyHandlers_());


  /**
   * ID of listener which catches user clicks inside active search filters.
   * @type {goog.events.Key}
   * @private
   */
  this.activeSearchFiltersClickId_ = goog.events.listen(
      this.elements_.getSearch_filters_div(),
      goog.events.EventType.MOUSEUP,
      goog.bind(function(event) {
        var e = /** @type {goog.events.Event} */ (event);
        var element = /** @type {Element} */ (e.target);
        if (goog.dom.classes.has(element, org.jboss.search.Constants.ACTIVE_SEARCH_FILTER_CLOSE)) {
          var activeSearchFilterType = element.getAttribute(org.jboss.search.Constants.ACTIVE_SEARCH_FILTER_TYPE);
          if (activeSearchFilterType) {
            switch (activeSearchFilterType) {
              case org.jboss.search.util.searchFilterGenerator.activeFilterType.DATE:
                /** @type {?org.jboss.core.context.RequestParams} */
                var rp = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
                if (goog.isDefAndNotNull(rp)) {
                  // reset date filter related fields, but also page field
                  var rpf = org.jboss.core.context.RequestParamsFactory.getInstance();
                  rp = rpf.reset().copy(rp).setFrom(null).setTo(null).setOrder(
                      org.jboss.core.context.RequestParams.Order.SCORE
                      ).build();
                  this.dispatchEvent(
                      new org.jboss.search.page.event.QuerySubmitted(rp)
                  );
                }
                break;
              default:
                // ignore, unsupported active filter type...
            }
          }
        }
      }, this));


  /**
   * ID of listener which catches user clicks inside search results.
   * @type {goog.events.Key}
   * @private
   */
  this.searchResultsClickId_ = goog.events.listen(
      this.elements_.getSearch_results_div(),
      goog.events.EventType.MOUSEUP,
      goog.bind(function(event) {
        var e = /** @type {goog.events.Event} */ (event);
        var element = /** @type {Element} */ (e.target);
        while (element) {
          var hitNumber;
          // user clicked individual search hit, we want to record click-stream
          if (goog.dom.classes.has(element, org.jboss.search.Constants.CLICK_STREAM_CLASS)) {
            hitNumber = element.getAttribute(org.jboss.search.Constants.HIT_NUMBER);
            if (hitNumber) {
              try {
                hitNumber = +hitNumber;
              } catch (err) { /* ignore */
              }
              if (goog.isNumber(hitNumber)) {
                var d = org.jboss.core.service.Locator.getInstance().getLookup().getRecentQueryResultData();
                var clickedHit = d && d.hits && d.hits.hits && d.hits.hits[hitNumber];
                if (clickedHit) {
                  var _id = clickedHit._id;
                  var uuid = d.uuid;
                  if (_id && uuid) {
                    org.jboss.search.request.writeClickStreamStatistics(this.getUserClickStreamUri(), uuid, _id);
                  }
                }
              }
            }
            break;
          }
          // user clicked pagination, we want to record click-stream and issue a new search request
          if (goog.dom.classes.has(element, org.jboss.search.Constants.PAGINATION_CLASS)) {
            var pageNumber = element.getAttribute(org.jboss.search.Constants.PAGINATION_NUMBER);
            if (pageNumber) {
              /** @preserveTry */
              try {
                pageNumber = +pageNumber;
              } catch (err) { /* ignore */
              }
              if (goog.isNumber(pageNumber)) {
                var rp_ = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
                var rpf = org.jboss.core.context.RequestParamsFactory.getInstance();
                rp_ = rpf.reset().copy(rp_).setPage(/** @type {number} */(pageNumber)).build();
                this.dispatchEvent(
                    new org.jboss.search.page.event.QuerySubmitted(rp_)
                );
                // TODO: call writeClickStreamStatistics
              }
            }
            break;
          }
          // user clicked avatar image, open profile app
          if (goog.dom.classes.has(element, org.jboss.search.Constants.CONTRIBUTOR_CLASS)) {
            hitNumber = element.getAttribute(org.jboss.search.Constants.HIT_NUMBER);
            var contributorNumber = element.getAttribute(org.jboss.search.Constants.CONTRIBUTOR_NUMBER);
            if (hitNumber && contributorNumber) {
              /** @preserveTry */
              try {
                hitNumber = +hitNumber;
                contributorNumber = +contributorNumber;
              } catch (err) { /* ignore */
              }
              if (goog.isNumber(hitNumber) && goog.isNumber(contributorNumber)) {
                var rd_ = org.jboss.core.service.Locator.getInstance().getLookup().getRecentQueryResultData();
                /** @preserveTry */
                try {
                  var c_ = rd_['hits']['hits'][hitNumber]['fields']['sys_contributors'];
                  var contributorId = goog.isArray(c_) ? c_[contributorNumber] : c_;
                  this.log_.fine('Opening profile for [' + contributorId + ']');
                  this.dispatchEvent(
                      new org.jboss.search.page.event.ContributorIdSelected(contributorId)
                  );
                } catch (err) {
                  this.log_.warning('Can not open profile', err);
                }
              }
            }
            break;
          }
          // step one level up ...
          element = goog.dom.getParentElement(element);
        }
      }, this)
      );


  /**
   * ID of listener which catches mouse over events for contributor icons.
   * @type {goog.events.Key}
   * @private
   */
  this.contributorMouseOverId_ = goog.events.listen(
      this.elements_.getSearch_results_div(),
      goog.events.EventType.MOUSEOVER,
      function(event) {
        var e = /** @type {goog.events.Event} */ (event);
        var element = /** @type {Element} */ (e.target);
        while (element) {
          // When mouse is over small contributor avatar then do two things:
          // - change name to selected contributor
          // - change src of large avatar img on the left to search hit
          // (this is one nasty piece of code...)
          if (goog.dom.classes.has(element, org.jboss.search.Constants.CONTRIBUTOR_CLASS)) {
            var hitNumber = element.getAttribute(org.jboss.search.Constants.HIT_NUMBER);
            var contributorNumber = element.getAttribute(org.jboss.search.Constants.CONTRIBUTOR_NUMBER);
            if (hitNumber && contributorNumber) {
              // we have both values: hit number and contributor number
              try {
                hitNumber = +hitNumber;
              } catch (err) { /* ignore */
              }
              try {
                contributorNumber = +contributorNumber;
              } catch (err) { /* ignore */
              }
              if (goog.isNumber(hitNumber) && goog.isNumber(contributorNumber)) {
                // both are numbers, good...
                var d = org.jboss.core.service.Locator.getInstance().getLookup().getRecentQueryResultData();
                var currentHit = d && d.hits && d.hits.hits && d.hits.hits[hitNumber];
                if (currentHit && currentHit.fields && currentHit.fields.sys_contributors_view) {
                  var contributor = currentHit.fields.sys_contributors_view[contributorNumber];
                  if (contributor) {
                    // contributor data found in query response
                    var contributorListElement = goog.dom.getParentElement(element);
                    var nameElement = goog.dom.getElementByClass(
                        'selected_contributor_name',
                        contributorListElement
                        );
                    if (nameElement) {
                      // Element holding the name of contributor found
                      var valueElement = goog.dom.getElementByClass('value', nameElement);
                      if (valueElement && valueElement != contributor.name) {
                        goog.dom.setTextContent(
                            valueElement,
                            contributor.name
                        );
                      }
                    }
                    var hitElement = goog.dom.getParentElement(
                        goog.dom.getParentElement(contributorListElement)
                        );
                    if (hitElement) {
                      var leftElement = goog.dom.getElementByClass('left', hitElement);
                      if (leftElement) {
                        var avatarElement = goog.dom.getElementByClass('avatar', leftElement);
                        if (avatarElement) {
                          var avatarImg = goog.dom.getFirstElementChild(avatarElement);
                          if (avatarImg) {
                            // img Element holding contributor large avatar found
                            var currentSRC = avatarImg.getAttribute('src');
                            if (currentSRC && currentSRC != contributor.gURL40) {
                              if (goog.isNull(avatarImg.onerror)) {
                                // We have to create new img element because the existing one have the 'onerror'
                                // function already executed (therefore it is set to null). (see #62)
                                var i_ = goog.dom.createDom('img', {});
                                i_.setAttribute('onerror', 'this.onerror=null;this.src="image/test/generic.png"');
                                i_.setAttribute('src', contributor.gURL40);
                                goog.dom.replaceNode(i_, avatarImg);
                              } else {
                                avatarImg.setAttribute('src', contributor.gURL40);
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            break;
          }
          element = goog.dom.getParentElement(element);
        }
      }
      );

  /** @private */
  this.userIdle_ = new org.jboss.search.page.UserIdle(this.elements_.getSearch_results_div());

  /** @private */
  this.userIdleDelay_ = new goog.async.Delay(
      goog.bind(this.userIdle_.start, this.userIdle_),
      org.jboss.search.Variables.USER_IDLE_INTERVAL
      );

  this.userIdleDelay_.start();

};
goog.inherits(org.jboss.search.page.SearchPage, goog.events.EventTarget);


/** @override */
org.jboss.search.page.SearchPage.prototype.disposeInternal = function() {

  org.jboss.search.page.SearchPage.superClass_.disposeInternal.call(this);

  goog.dispose(this.elements_);
  goog.dispose(this.userQuerySearchField_);
  goog.dispose(this.query_suggestions_view_);
  goog.dispose(this.userIdle_);
  goog.dispose(this.userIdleDelay_);

  goog.events.unlistenByKey(this.dateClickListenerId_);
  goog.events.unlistenByKey(this.projectClickListenerId_);
  goog.events.unlistenByKey(this.authorClickListenerId_);
  goog.events.unlistenByKey(this.contentClickListenerId_);
  goog.events.unlistenByKey(this.contextClickListenerId_);
  goog.events.unlistenByKey(this.xhrReadyListenerId_);
  goog.events.unlistenByKey(this.xhrCompleteListenerId_);
  goog.events.unlistenByKey(this.xhrErrorListenerId_);
  goog.events.unlistenByKey(this.xhrAbortListenerId_);
  goog.events.unlistenByKey(this.query_field_focus_id_);
  goog.events.unlistenByKey(this.activeSearchFiltersClickId_);
  goog.events.unlistenByKey(this.searchResultsClickId_);
  goog.events.unlistenByKey(this.contributorMouseOverId_);
  goog.events.unlistenByKey(this.userQueryServiceDispatcherListenerId_);
  goog.events.unlistenByKey(this.userSuggestionsQueryServiceDispatcherListenerId_);

  this.unlistenTechnologyFilter_();
  this.unlistenContentFilter_();
  this.unlistenDateFilter_();
  this.unlistenAuthorFilter_();

  this.log_ = null;
  delete this.xhrManager_;
  this.context_ = null;
  this.query_suggestions_model_ = null;
  delete this.queryServiceDispatcher_;
  delete this.elements_;
  delete this.authorFilterElements_;
  delete this.technologyFilterElements_;
  delete this.contentFilterElements_;
  delete this.dateFilterElements_;
};


/**
 * @return {goog.Uri} Search Suggestions Service URI
 */
org.jboss.search.page.SearchPage.prototype.getSuggestionsUri = function() {
  return this.SUGGESTIONS_URI_.clone();
};


/**
 * @return {goog.Uri} Query Search Service URI
 */
org.jboss.search.page.SearchPage.prototype.getSearchUri = function() {
  return this.SEARCH_URI_.clone();
};


/**
 * @return {goog.Uri} URI of service to record user click stream.
 */
org.jboss.search.page.SearchPage.prototype.getUserClickStreamUri = function() {
  return this.USER_CLICK_STREAM_URI_.clone();
};


/**
 * Unlisten on content filter listeners.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.unlistenContentFilter_ = function() {
  // unlisten if already registered
  if (goog.isDefAndNotNull(this.newRequestParamsFromContentFilterKey_)) {
    goog.events.unlistenByKey(this.newRequestParamsFromContentFilterKey_);
  }
};


/**
 *
 * @param {org.jboss.search.page.filter.ContentFilter} contentFilter
 */
org.jboss.search.page.SearchPage.prototype.listenOnContentFilterChanges = function(contentFilter) {
  this.unlistenContentFilter_();
  if (goog.isDefAndNotNull(contentFilter)) {
    this.newRequestParamsFromContentFilterKey_ = goog.events.listen(
        contentFilter,
        [
          org.jboss.search.page.filter.NewRequestParamsEventType.NEW_REQUEST_PARAMETERS
        ],
        function(e) {
          var event = /** @type {org.jboss.search.page.filter.NewRequestParamsEvent} */ (e);
          this.dispatchEvent(
              new org.jboss.search.page.event.QuerySubmitted(
                  event.getRequestParameters()
              )
          );
        }, false, this
        );
  }
};


/**
 * Unlisten on technology filter listeners.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.unlistenTechnologyFilter_ = function() {
  if (goog.isDefAndNotNull(this.newRequestParamsFromTechnologyFilterKey_)) {
    goog.events.unlistenByKey(this.newRequestParamsFromTechnologyFilterKey_);
  }
};


/**
 *
 * @param {org.jboss.search.page.filter.TechnologyFilter} technologyFilter
 */
org.jboss.search.page.SearchPage.prototype.listenOnTechnologyFilterChanges = function(technologyFilter) {
  // unlisten if already registered
  this.unlistenTechnologyFilter_();
  if (goog.isDefAndNotNull(technologyFilter)) {
    this.newRequestParamsFromTechnologyFilterKey_ = goog.events.listen(
        technologyFilter,
        [
          org.jboss.search.page.filter.NewRequestParamsEventType.NEW_REQUEST_PARAMETERS
        ],
        function(e) {
          var event = /** @type {org.jboss.search.page.filter.NewRequestParamsEvent} */ (e);
          this.dispatchEvent(
              new org.jboss.search.page.event.QuerySubmitted(
                  event.getRequestParameters()
              )
          );
        }, false, this
        );
  }
};


/**
 * Unlisten on Author filter listeners.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.unlistenAuthorFilter_ = function() {
  if (goog.isDefAndNotNull(this.newRequestParamsFromAuthorFilterKey_)) {
    goog.events.unlistenByKey(this.newRequestParamsFromAuthorFilterKey_);
  }
};


/**
 *
 * @param {org.jboss.search.page.filter.AuthorFilter} authorFilter
 */
org.jboss.search.page.SearchPage.prototype.listenOnAuthorFilterChanges = function(authorFilter) {
  // unlisten if already registered
  this.unlistenAuthorFilter_();
  if (goog.isDefAndNotNull(authorFilter)) {
    this.newRequestParamsFromAuthorFilterKey_ = goog.events.listen(
        authorFilter,
        [
          org.jboss.search.page.filter.NewRequestParamsEventType.NEW_REQUEST_PARAMETERS
        ],
        function(e) {
          var event = /** @type {org.jboss.search.page.filter.NewRequestParamsEvent} */ (e);
          this.dispatchEvent(
              new org.jboss.search.page.event.QuerySubmitted(
                  event.getRequestParameters()
              )
          );
        }, false, this
        );
  }
};


/**
 * Unlisten listeners related to date filter.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.unlistenDateFilter_ = function() {
  if (goog.isDefAndNotNull(this.dateFilterIntervalSelectedId_)) {
    goog.events.unlistenByKey(this.dateFilterIntervalSelectedId_);
  }
  if (goog.isDefAndNotNull(this.dateOrderByChangedId_)) {
    goog.events.unlistenByKey(this.dateOrderByChangedId_);
  }
  if (goog.isDefAndNotNull(this.dateRangeChangedId_)) {
    goog.events.unlistenByKey(this.dateRangeChangedId_);
  }
};


/**
 *
 * @param {org.jboss.search.page.filter.DateFilter} dateFilter
 */
org.jboss.search.page.SearchPage.prototype.listenOnDateFilterChanges = function(dateFilter) {
  // unlisten if already registered
  this.unlistenDateFilter_();

  if (goog.isDefAndNotNull(dateFilter)) {

    // register listener on date filter interval changes caused by histogram chart brush
    if (goog.isDefAndNotNull(dateFilter.getHistogramChart())) {
      this.dateFilterIntervalSelectedId_ = goog.events.listen(
          dateFilter.getHistogramChart(),
          org.jboss.core.visualization.HistogramEventType.INTERVAL_SELECTED,
          goog.bind(function(e) {
            var event = /** @type {org.jboss.core.visualization.IntervalSelected} */ (e);
            // update dates in the web form
            dateFilter.setFromValue(event.getFrom());
            dateFilter.setToValue(event.getTo());
            // if last, then fire an event
            if (event.isLast()) {
              var rp = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
              if (goog.isDefAndNotNull(rp)) {
                // TODO: consider rounding 'from' and 'to' to hours or days
                // (for monthly granular chart it makes little sense to use minutes...)
                // set 'page' to 1
                var rpf = org.jboss.core.context.RequestParamsFactory.getInstance();
                rp = rpf.reset().copy(rp).setPage(1).setFrom(event.getFrom()).setTo(event.getTo()).build();
                this.dispatchEvent(
                    new org.jboss.search.page.event.QuerySubmitted(rp)
                );
              }
            }
          }, this)
          );
    }

    // register listener on date orderBy changes
    this.dateOrderByChangedId_ = goog.events.listen(
        dateFilter,
        org.jboss.search.page.filter.DateFilterEventType.DATE_ORDER_BY_CHANGED,
        goog.bind(function(e) {
          var event = /** @type {org.jboss.search.page.filter.DateOrderByChanged} */ (e);
          var orderBy = event.getOrderBy();
          if (goog.isDefAndNotNull(orderBy)) {
            var rp = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
            if (goog.isDefAndNotNull(rp)) {
              var rpf = org.jboss.core.context.RequestParamsFactory.getInstance();
              rp = rpf.reset().copy(rp).setOrder(orderBy).build();
              this.dispatchEvent(
                  new org.jboss.search.page.event.QuerySubmitted(rp)
              );
            }
          }
        }, this)
        );

    // register listener on date range changes caused by manual date selection
    this.dateRangeChangedId_ = goog.events.listen(
        dateFilter,
        org.jboss.search.page.filter.DateFilterEventType.DATE_RANGE_CHANGED,
        goog.bind(function(e) {
          var event = /** @type {org.jboss.search.page.filter.DateRangeChanged} */ (e);
          var from = event.getFrom();
          var to = event.getTo();
          if (goog.isDef(from) || goog.isDef(to)) {
            var rp = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
            if (goog.isDefAndNotNull(rp)) {
              var rpf = org.jboss.core.context.RequestParamsFactory.getInstance();
              rp = rpf.reset().copy(rp).setFrom(from).setTo(to).build();
              this.dispatchEvent(
                  new org.jboss.search.page.event.QuerySubmitted(rp)
              );
            }
          }
        }, this));
  }
};


/**
 * Set user query and execute the query.
 * @param {!org.jboss.core.context.RequestParams} requestParams
 */
org.jboss.search.page.SearchPage.prototype.runSearch = function(requestParams) {
  var queryService = org.jboss.core.service.Locator.getInstance().getLookup().getQueryService();
  queryService.userQuery(requestParams);
};


/**
 * Render HTML representation of search results.
 * It assumes the search results are stored in the lookup.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.renderSearchResults_ = function() {
  var normalizedResponse = org.jboss.core.service.Locator.getInstance().getLookup().getRecentQueryResultData();
  try {
    // generate HTML for search results
    var html = org.jboss.search.page.templates.search_results(normalizedResponse);
    this.elements_.getSearch_results_div().innerHTML = html;
    // pre-load avatar images
    this.preLoadAvatarImages_(normalizedResponse);
  } catch (error) {
    // Something went wrong when generating HTML output
    // TODO fire event (with error)
    this.log_.severe('Something went wrong', error);
  }
};


/**
 * Render HTML representation of search filters.
 * It assumes the search filters are stored in the lookup.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.renderSearchFilters_ = function() {
  var requestParams = org.jboss.core.service.Locator.getInstance().getLookup().getRequestParams();
  var searchFilters = org.jboss.search.util.searchFilterGenerator.generateFilters(requestParams);
  try {
    // generate HTML for active search filters
    var html = org.jboss.search.page.templates.search_filters({filters: searchFilters});
    this.elements_.getSearch_filters_div().innerHTML = html;
  } catch (error) {
    // Something went wrong when generating HTML output
    // TODO fire event (with error)
    this.log_.severe('Something went wrong', error);
  }
};


/**
 *
 * @param {string} query_string
 * @param {string} error
 * @private
 */
org.jboss.search.page.SearchPage.prototype.renderQueryResponseError_ = function(query_string, error) {
  var html = org.jboss.search.page.templates.request_error({
    'user_query': query_string,
    'error': error
  });
  this.elements_.getSearch_results_div().innerHTML = html;
};


/**
 * Clear (remove) all search results from the screen.
 */
org.jboss.search.page.SearchPage.prototype.clearSearchResults = function() {
  // TODO: check if we need stop any listeners
  this.elements_.getSearch_results_div().innerHTML = '';
};


/**
 * Collapse all filter tabs.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.collapseAllFilters_ = function() {
  if (this.isAuthorFilterExpanded_()) this.collapseAuthorFilter_();
  if (this.isTechnologyFilterExpanded_()) this.collapseTechnologyFilter_();
  if (this.isDateFilterExpanded_()) this.collapseDateFilter_();
};


/**
 * Prototype URI
 * @private
 * @type {goog.Uri}
 * @const
 */
org.jboss.search.page.SearchPage.prototype.SUGGESTIONS_URI_ = goog.Uri.parse(org.jboss.search.Constants.API_URL_SUGGESTIONS_QUERY);


/**
 * Prototype URI
 * @private
 * @type {goog.Uri}
 * @const
 */
org.jboss.search.page.SearchPage.prototype.SEARCH_URI_ = goog.Uri.parse(org.jboss.search.Constants.API_URL_SEARCH_QUERY);


/**
 * Prototype URI
 * @private
 * @type {goog.Uri}
 * @const
 */
org.jboss.search.page.SearchPage.prototype.USER_CLICK_STREAM_URI_ = goog.Uri.parse(org.jboss.search.Constants.API_URL_RECORD_USER_CLICK_STREAM);


/**
 * Set value of query field.
 * @param {?string} query
 * @private
 */
org.jboss.search.page.SearchPage.prototype.setUserQuery_ = function(query) {
  var newValue = '';
  if (query != null && !goog.string.isEmpty(query)) {
    newValue = goog.string.collapseWhitespace(query);
    if (goog.string.endsWith(query, ' ')) {
      newValue += ' ';
    }
  }
  this.elements_.getQuery_field().value = newValue;
};


/**
 * Stop and release (dispose) all resources related to user entertainment.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.disposeUserEntertainment_ = function() {
  this.userIdleDelay_.stop();
  goog.dispose(this.userIdle_);
};


/** @private */
org.jboss.search.page.SearchPage.prototype.disableSearchResults_ = function() {
  goog.dom.classes.add(this.elements_.getSearch_results_div(), org.jboss.core.Constants.DISABLED);
};


/** @private */
org.jboss.search.page.SearchPage.prototype.enableSearchResults_ = function() {
  goog.dom.classes.remove(this.elements_.getSearch_results_div(), org.jboss.core.Constants.DISABLED);
};


/**
 * @return {!Object.<(goog.events.KeyCodes|number), function(goog.events.KeyEvent, goog.async.Delay)>}
 * @private
 */
org.jboss.search.page.SearchPage.prototype.getPresetKeyHandlers_ = function() {

  /**
   * @param {goog.events.KeyEvent} event
   * @param {goog.async.Delay} delay
   */
  var keyCodeEscHandler = goog.bind(function(event, delay) {
    if (!event.repeat) {
      delay.stop();
      this.hideAndCleanSuggestionsElementAndModel_();
    }
  }, this);

  /**
   * @param {goog.events.KeyEvent} event
   * @param {goog.async.Delay} delay
   */
  var keyCodeDownHandler = goog.bind(function(event, delay) {
    event.preventDefault();
    if (this.query_suggestions_view_.isVisible()) {
      this.query_suggestions_view_.selectNext();
    }
  }, this);

  /**
   * @param {goog.events.KeyEvent} event
   * @param {goog.async.Delay} delay
   */
  var keyCodeUpHandler = goog.bind(function(event, delay) {
    event.preventDefault();
    if (this.query_suggestions_view_.isVisible()) {
      this.query_suggestions_view_.selectPrevious();
    }
  }, this);

  /**
   * @param {goog.events.KeyEvent} event
   * @param {goog.async.Delay} delay
   */
  var keyCodeRightHandler = function(event, delay) {
    // will do something later...
  };

  /**
   * @param {goog.events.KeyEvent} event
   * @param {goog.async.Delay} delay
   */
  var keyCodeTabHandler = goog.bind(function(event, delay) {
    delay.stop();
    this.hideAndCleanSuggestionsElementAndModel_();
  }, this);

  /**
   * @param {goog.events.KeyEvent} event
   * @param {goog.async.Delay} delay
   */
  var keyCodeEnterHandler = goog.bind(function(event, delay) {
    var query;
    var selectedIndex = this.query_suggestions_view_.getSelectedIndex();
    this.hideAndCleanSuggestionsElementAndModel_();
    event.preventDefault();
    delay.stop();
    if (selectedIndex < 0) {
      // user hit enter and no suggestions are displayed (yet) use content of query field
      query = this.elements_.getQuery_field().value;
      this.dispatchEvent(
          new org.jboss.search.page.event.QuerySubmitted(
              org.jboss.core.context.RequestParamsFactory.getInstance()
                .reset()
                .setQueryString(query)
                .build()
          )
      );
    } else if (selectedIndex == 0) {
      // suggestions are displayed, user selected the first one (use what is in query field)
      query = this.elements_.getQuery_field().value;
      this.dispatchEvent(
          new org.jboss.search.page.event.QuerySubmitted(
              org.jboss.core.context.RequestParamsFactory.getInstance()
                .reset()
                .setQueryString(query)
                .build()
          )
      );
    } else if (selectedIndex > 0) {
      // user selected from suggestions, use what is in model
      // TODO get query_string from model at the selectedIndex position
      this.dispatchEvent(
          new org.jboss.search.page.event.QuerySubmitted(
              org.jboss.core.context.RequestParamsFactory.getInstance()
                .reset()
                .setQueryString('option was selected by keys (index: ' + selectedIndex + ')')
                .build()
          )
      );
    }
  }, this);

  // prepare keyHandlers for the main search field
  var keyHandlers = {};

  keyHandlers[goog.events.KeyCodes.ESC] = keyCodeEscHandler;
  keyHandlers[goog.events.KeyCodes.UP] = keyCodeUpHandler;
  keyHandlers[goog.events.KeyCodes.DOWN] = keyCodeDownHandler;
  keyHandlers[goog.events.KeyCodes.RIGHT] = keyCodeRightHandler;
  keyHandlers[goog.events.KeyCodes.ENTER] = keyCodeEnterHandler;

  // TAB key does not seem to yield true in @see {goog.events.KeyCodes.isTextModifyingKeyEvent}
  // thus we have to handle it
  keyHandlers[goog.events.KeyCodes.TAB] = keyCodeTabHandler;

  return keyHandlers;
};


/**
 * Hide and clean suggestions element and empty the suggestions model.
 * @private
 */
org.jboss.search.page.SearchPage.prototype.hideAndCleanSuggestionsElementAndModel_ = function() {

  this.xhrManager_.abort(org.jboss.search.Constants.SEARCH_SUGGESTIONS_REQUEST_ID, true);
  // abort with 'true' does not fire any event, thus we have to fire our own event
  this.dispatchEvent(org.jboss.search.suggestions.event.EventType.SEARCH_FINISH);

  this.query_suggestions_view_.hide();
  this.query_suggestions_model_ = {};
};


/**
 * TODO
 * @param {!Object} model
 * @return {!Object}
 * @private
 */
org.jboss.search.page.SearchPage.prototype.parseQuerySuggestionsModel_ = function(model) {
  return model;
};


/**
 * @return {boolean}
 * @private
 */
org.jboss.search.page.SearchPage.prototype.isDateFilterExpanded_ = function() {
  return !goog.dom.classes.has(this.dateFilterElements_.getHostingElement(), org.jboss.core.Constants.HIDDEN);
};


/**
 * @return {boolean}
 * @private
 */
org.jboss.search.page.SearchPage.prototype.isTechnologyFilterExpanded_ = function() {
  return !goog.dom.classes.has(this.technologyFilterElements_.getHostingElement(), org.jboss.core.Constants.HIDDEN);
};


/**
 * @return {boolean}
 * @private
 */
org.jboss.search.page.SearchPage.prototype.isAuthorFilterExpanded_ = function() {
  return !goog.dom.classes.has(this.authorFilterElements_.getHostingElement(), org.jboss.core.Constants.HIDDEN);
};


/**
 * @return {boolean}
 * @private
 */
org.jboss.search.page.SearchPage.prototype.isContentFilterExpanded_ = function() {
  return !goog.dom.classes.has(this.contentFilterElements_.getHostingElement(), org.jboss.core.Constants.HIDDEN);
};


/** @private */
org.jboss.search.page.SearchPage.prototype.expandDateFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getDateFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.expandFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.expandAuthorFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getAuthorFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.expandFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.expandContentFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getContentFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.expandFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.expandTechnologyFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getTechnologyFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.expandFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.collapseDateFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getDateFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.collapseFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.collapseTechnologyFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getTechnologyFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.collapseFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.collapseAuthorFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getAuthorFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.collapseFilter();
  }
};


/** @private */
org.jboss.search.page.SearchPage.prototype.collapseContentFilter_ = function() {
  var filter = org.jboss.core.service.Locator.getInstance().getLookup().getContentFilter();
  if (goog.isDefAndNotNull(filter)) {
    filter.collapseFilter();
  }
};


/**
 * Pre-load large avatar images of contributors found in the data.
 * <p/>
 * First, it grab all contributors from search results and start pre-loading large
 * 40x40px avatars. This is to ensure that when user mouseover small avatars the large avatar changes instantly without
 * noticeable loading.
 * <p/>
 * Second, it pre-load avatar icons found in the top_contributor facet. This to make sure there is minimal visual
 * distraction when the author filter is opened. Number of avatars pre-loaded is limited
 * by org.jboss.search.Variables.CONTRIBUTOR_FACET_AVATAR_PRELOAD_CNT.
 * @param {Object} data
 * @private
 */
org.jboss.search.page.SearchPage.prototype.preLoadAvatarImages_ = function(data) {
  var imageLoader = org.jboss.core.service.Locator.getInstance().getLookup().getImageLoader();
  if (data && data.hits && data.hits.hits) {
    goog.array.forEach(
        data.hits.hits,
        function(hit) {
          if (hit.fields && hit.fields.sys_contributors_view) {
            goog.array.forEach(
                hit.fields.sys_contributors_view,
                function(c) {
                  if (goog.isString(c.gURL40)) {
                    imageLoader.addImage(c.gURL40, c.gURL40);
                  }
                }
            );
          }
        }
    );
    imageLoader.start();
  }
  if (data && data.facets && data.facets.top_contributors && data.facets.top_contributors.terms) {
    var cnt = org.jboss.search.Variables.CONTRIBUTOR_FACET_AVATAR_PRELOAD_CNT;
    // sanity check
    cnt = cnt < 0 ? 0 : cnt;
    goog.array.forEach(
        data.facets.top_contributors.terms,
        function(term) {
          if (cnt > 0 && goog.isString(term.gURL16)) {
            imageLoader.addImage(term.gURL16, term.gURL16);
            cnt -= 1;
          }
        }
    );
    imageLoader.start();
  }
};
