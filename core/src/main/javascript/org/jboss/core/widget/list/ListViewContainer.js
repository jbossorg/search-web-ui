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
 * @author lvlcek@redhat.com (Lukas Vlcek)
 */
goog.provide('org.jboss.core.widget.list.ListViewContainer');

goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.BrowserEvent');
goog.require('goog.events.EventTarget');
goog.require('goog.events.EventType');
goog.require('goog.events.Key');
goog.require('goog.string');
goog.require('org.jboss.core.widget.list.ListModel');
goog.require('org.jboss.core.widget.list.ListModelContainer');
goog.require('org.jboss.core.widget.list.ListModelContainerEvent');
goog.require('org.jboss.core.widget.list.ListModelContainerEventType');
goog.require('org.jboss.core.widget.list.ListView');
goog.require('org.jboss.core.widget.list.event.ListModelEvent');
goog.require('org.jboss.core.widget.list.event.ListModelEventType');
goog.require('org.jboss.core.widget.list.event.ListViewEvent');
goog.require('org.jboss.core.widget.list.event.ListViewEventType');



/**
 *
 * @param {!Array.<org.jboss.core.widget.list.ListView>} views
 * @param {!org.jboss.core.widget.list.ListModelContainer} listModelContainer
 * @param {!Element} hostingElement
 * @constructor
 * @extends {goog.events.EventTarget}
 */
org.jboss.core.widget.list.ListViewContainer = function(views, listModelContainer, hostingElement) {
  goog.events.EventTarget.call(this);

  /**
   * @type {!Array.<org.jboss.core.widget.list.ListView>}
   * @private
   */
  this.views_ = views;

  /**
   * @type {Object}
   * @private
   */
  this.viewDoms_ = {};

  /**
   * @type {!Element}
   * @private
   */
  this.hostingElement_ = hostingElement;
  goog.dom.removeChildren(this.hostingElement_);

  // generate and keep DOMs for all view
  goog.array.forEach(
      this.views_,
      function(listView) {
        var listDom = listView.constructDOM([]);
        this.viewDoms_[listView.getId()] = listDom;
        goog.dom.appendChild(this.hostingElement_, listDom);
      },
      this
  );

  /**
   * View listeners.
   *
   * @type {Array.<goog.events.Key>}
   * @private
   */
  this.viewListenersKeys_ = [];

  /**
   * Listens for clicks propagated to the hosting element.
   * It investigates if the event target has an id attribute value. If yes then the
   * id attribute value and relevant action is passed to {@link ListModelContainer}.
   *
   * TODO: remove if note used
   *
   * @type {goog.events.Key}
   * @private
   */
  this.hostingElementListenerKey_ = goog.events.listen(
      this.hostingElement_,
      goog.events.EventType.CLICK,
      function(e) {
        var event = /** @type {goog.events.BrowserEvent} */ (e);
        if (goog.isDefAndNotNull(event.target.id) && !goog.string.isEmptySafe(event.target.id)) {
          var id = event.target.id;
          listModelContainer.listItemAction(id, 'click');
        }
      }, false, this
      );

  /**
   *
   * @type {goog.events.Key}
   * @private
   */
  this.listModelEventKey_ = goog.events.listen(
      listModelContainer,
      [
        org.jboss.core.widget.list.event.ListModelEventType.NEW_DATA_SET,
        org.jboss.core.widget.list.event.ListModelEventType.LIST_ITEM_SELECTED,
        org.jboss.core.widget.list.event.ListModelEventType.LIST_ITEM_DESELECTED,
        org.jboss.core.widget.list.event.ListModelEventType.ALL_LIST_ITEMS_DESELECTED,
        org.jboss.core.widget.list.ListModelContainerEventType.LIST_ITEM_POINTED,
        org.jboss.core.widget.list.ListModelContainerEventType.LIST_ITEM_DEPOINTED
      ],
      function(e) {
        // TODO: the following type declaration is not clean...
        var event = /** @type {org.jboss.core.widget.list.event.ListModelEvent|org.jboss.core.widget.list.ListModelContainerEvent} */ (e);
        switch (event.getType()) {
          // create a new item list based on new data
          // this operation replaces DOM element which is related to changed list model only
          case org.jboss.core.widget.list.event.ListModelEventType.NEW_DATA_SET:
            var lm = /** @type {org.jboss.core.widget.list.ListModel} */ (event.target);
            var id = lm.getId();
            var data = lm.getData();
            var listView = this.getListViewById_(id);
            if (goog.isDefAndNotNull(listView)) {
              var oldViewDom = this.viewDoms_[id];
              var newViewDom = listView.constructDOM(data);
              // keep reference to the new DOM
              this.viewDoms_[id] = newViewDom;
              // if replacing the DOM element is slow or visually distracting, we could do
              // diff and modification of the old element instead (like ReactJS does).
              goog.dom.replaceNode(newViewDom, oldViewDom);
              this.dispatchEvent(
                  new org.jboss.core.widget.list.event.ListViewEvent(
                      listView,
                      org.jboss.core.widget.list.event.ListViewEventType.VIEW_UPDATE
                  )
              );
            }
            break;

          // update DOM and highlight particular list item
          case org.jboss.core.widget.list.ListModelContainerEventType.LIST_ITEM_POINTED:
            var evt = /** @type {org.jboss.core.widget.list.ListModelContainerEvent} */ (event);
            var lm = /** @type {org.jboss.core.widget.list.ListModel} */ (evt.target);
            var id = lm.getId();
            var data = lm.getData();
            var listView = this.getListViewById_(id);
            if (goog.isDefAndNotNull(listView)) {
              var oldViewDom = this.viewDoms_[id];
              var newViewDom = listView.constructDOM(data, evt.getItemIndex());
              // keep reference to the new DOM
              this.viewDoms_[id] = newViewDom;
              // if replacing the DOM element is slow or visually distracting, we could do
              // diff and modification of the old element instead (like ReactJS does).
              goog.dom.replaceNode(newViewDom, oldViewDom);
              this.dispatchEvent(
                  new org.jboss.core.widget.list.event.ListViewEvent(
                      listView,
                      org.jboss.core.widget.list.event.ListViewEventType.VIEW_UPDATE
                  )
              );
            }
            break;

          // update DOM and de-highlight particular list item
          case org.jboss.core.widget.list.ListModelContainerEventType.LIST_ITEM_DEPOINTED:
            var evt = /** @type {org.jboss.core.widget.list.ListModelContainerEvent} */ (event);
            var lm = /** @type {org.jboss.core.widget.list.ListModel} */ (evt.target);
            var id = lm.getId();
            var data = lm.getData();
            var listView = this.getListViewById_(id);
            if (goog.isDefAndNotNull(listView)) {
              var oldViewDom = this.viewDoms_[id];
              var newViewDom = listView.constructDOM(data);
              // keep reference to the new DOM
              this.viewDoms_[id] = newViewDom;
              // if replacing the DOM element is slow or visually distracting, we could do
              // diff and modification of the old element instead (like ReactJS does).
              goog.dom.replaceNode(newViewDom, oldViewDom);
              this.dispatchEvent(
                  new org.jboss.core.widget.list.event.ListViewEvent(
                      listView,
                      org.jboss.core.widget.list.event.ListViewEventType.VIEW_UPDATE
                  )
              );
            }
            break;

          // update DOM and select particular list item
          case org.jboss.core.widget.list.event.ListModelEventType.LIST_ITEM_SELECTED:
            // probably do nothing
            break;

          // update DOM and de-select particular list item
          case org.jboss.core.widget.list.event.ListModelEventType.LIST_ITEM_DESELECTED:
            // probably do nothing
            break;

          // update DOM and de-select all list item
          case org.jboss.core.widget.list.event.ListModelEventType.ALL_LIST_ITEMS_DESELECTED:
            // probably do nothing
            break;
        }
      }, false, this
      );
};
goog.inherits(org.jboss.core.widget.list.ListViewContainer, goog.events.EventTarget);


/** @inheritDoc */
org.jboss.core.widget.list.ListViewContainer.prototype.disposeInternal = function() {
  org.jboss.core.widget.list.ListViewContainer.superClass_.disposeInternal.call(this);
  goog.events.unlistenByKey(this.listModelEventKey_);
  goog.events.unlistenByKey(this.hostingElementListenerKey_);
  delete this.views_;
  goog.array.forEach(this.viewListenersKeys_, function(key) {
    goog.events.unlistenByKey(key);
  });
};


/**
 *
 * @return {Object}
 */
org.jboss.core.widget.list.ListViewContainer.prototype.getViewDoms = function() {
  return this.viewDoms_;
};


/**
 * Return array of the latest DOM Elements.  Order of Elements is by initial order of {@link ListView}s.
 * @return {!Array.<Element>}
 */
org.jboss.core.widget.list.ListViewContainer.prototype.constructDOM = function() {
  var elements = [];
  goog.array.forEach(
      this.views_,
      function(listView) {
        elements.push(this.viewDoms_[listView.getId()]);
      },
      this
  );
  return elements;
};


/**
 *
 * @param {string} id
 * @return {?org.jboss.core.widget.list.ListView}
 * @private
 */
org.jboss.core.widget.list.ListViewContainer.prototype.getListViewById_ = function(id) {
  return goog.array.find(
      this.views_,
      function(listView) {
        return (listView.getId() == id);
      }
  );
};
