// This file was autogenerated by calcdeps.py
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/Variables.js", ['org.jboss.core.Variables'], []);
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/service/Locator.js", ['org.jboss.core.service.Locator'], []);
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/service/LookUp.js", ['org.jboss.core.service.LookUp'], ['org.jboss.core.service.query.QueryService', 'org.jboss.core.service.query.QueryServiceDispatcher', 'org.jboss.core.util.ImageLoader', 'goog.History', 'goog.i18n.DateTimeFormat', 'goog.i18n.DateTimeParse', 'goog.net.XhrManager']);
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/service/LookUpImpl.js", ['org.jboss.core.service.LookUpImpl'], ['org.jboss.core.service.query.QueryServiceDispatcher', 'org.jboss.core.service.query.QueryService', 'org.jboss.core.Variables', 'org.jboss.core.service.LookUp', 'org.jboss.core.util.ImageLoader', 'org.jboss.core.util.ImageLoaderNoop', 'goog.History', 'goog.i18n.DateTimeFormat', 'goog.i18n.DateTimeParse', 'goog.net.XhrManager']);
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/context/RequestParams.js", ['org.jboss.core.context.RequestParams', 'org.jboss.core.context.RequestParams.Order', 'org.jboss.core.context.RequestParamsFactory'], ['goog.date.DateTime']);
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/util/dateTime.js", ['org.jboss.core.util.dateTime'], ['org.jboss.core.service.Locator', 'goog.string', 'goog.date.DateTime', 'goog.i18n.DateTimeFormat']);
goog.addDependency("../../../core/src/main/javascript/org/jboss/core/util/fragmentParser.js", ['org.jboss.core.util.fragmentParser', 'org.jboss.core.util.fragmentParser.UI_param', 'org.jboss.core.util.fragmentParser.UI_param_suffix', 'org.jboss.core.util.fragmentParser.INTERNAL_param'], ['org.jboss.core.util.dateTime', 'org.jboss.core.context.RequestParams', 'org.jboss.core.context.RequestParams.Order', 'org.jboss.core.context.RequestParamsFactory', 'goog.array', 'goog.object', 'goog.string', 'goog.date', 'goog.date.DateTime']);
goog.addDependency("../../../core/src/test/javascript/org/jboss/core/util/fragmentParser_test.js", [], ['org.jboss.core.util.fragmentParser', 'goog.testing.jsunit']);