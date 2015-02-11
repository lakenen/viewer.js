/**
 * @fileoverview viewer-base component
 * @author lakenen
 */

Crocodoc.addComponent('viewer-base', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var util = scope.getUtility('common'),
        browser = scope.getUtility('browser'),
        promise = scope.getUtility('promise'),
        dom = scope.getUtility('dom'),
        hacks = scope.getUtility('browser-hacks'),
        support = scope.getUtility('support');

    var api, // the viewer API object
        config,
        viewerEl,
        stylesheetEl,
        layout,
        scroller,
        resizer,
        dragger,
        assetsPromise;

    /**
     * Add CSS classes to the element for necessary feature/support flags
     * @returns {void}
     * @private
     */
    function setCSSFlags() {
        // add SVG version number flag
        dom.attr(viewerEl, ATTR_SVG_VERSION, config.metadata.version || '0.0.0');

        //add CSS flags
        if (browser.mobile) {
            dom.addClass(viewerEl, CSS_CLASS_MOBILE);      //Mobile?
        }
        if (browser.ielt9) {
            dom.addClass(viewerEl, CSS_CLASS_IELT9);       //IE7 or IE8?
        }
        if (support.svg) {
            dom.addClass(viewerEl, CSS_CLASS_SUPPORTS_SVG);
        }
    }

    /**
     * Create and insert basic viewer DOM structure
     * @returns {void}
     * @private
     */
    function initViewerHTML() {
        // create viewer HTML
        dom.html(viewerEl, Crocodoc.viewerTemplate);
        if (config.useWindowAsViewport) {
            config.viewportEl = window;
            dom.addClass(viewerEl, CSS_CLASS_WINDOW_AS_VIEWPORT);
        } else {
            config.viewportEl = dom.find('.' + CSS_CLASS_VIEWPORT, viewerEl);
        }
        config.docEl = dom.find('.' + CSS_CLASS_DOC, viewerEl);
    }

    /**
     * Initialize all plugins specified for this viewer instance
     * @returns {void}
     * @private
     */
    function initPlugins() {
        var name,
            plugin,
            plugins = config.plugins || {};
        for (name in plugins) {
            plugin = scope.createComponent('plugin-' + name);
            if (plugin && util.isFn(plugin.init)) {
                plugin.init(config.plugins[name]);
            }
        }
    }

    /**
     * Complete intialization after document metadata has been loaded;
     * ie., bind events, init lazyloader and layout, broadcast ready message
     * @returns {void}
     * @private
     */
    function completeInit() {
        setCSSFlags();

        // initialize scroller and resizer components
        scroller = scope.createComponent('scroller');
        scroller.init(config.viewportEl);
        resizer = scope.createComponent('resizer');
        resizer.init(config.viewportEl);

        var controller;
        switch (config.metadata.type) {
            case 'text':
                // load text-based viewer
                controller = scope.createComponent('controller-text');
                // force the text layout only
                // @TODO: allow overriding the layout eventually
                config.layout = LAYOUT_TEXT;
                break;

            case 'paged':
                /* falls through */
            default:
                controller = scope.createComponent('controller-paged');
                break;
        }
        controller.init();

        // disable text selection if necessary
        if (config.metadata.type === 'text') {
            if (!config.enableTextSelection) {
                api.disableTextSelection();
            }
        } else if (!hacks.shouldUseTextLayer()) {
            api.disableTextSelection();
        }

        // disable links if necessary
        // @NOTE: links are disabled in IE < 9
        if (!config.enableLinks || !hacks.shouldEnableLinks()) {
            api.disableLinks();
        }

        // set the initial layout
        api.setLayout(config.layout);

        // broadcast ready message
        scope.broadcast('ready', {
            page: config.page || 1,
            numPages: config.numPages
        });

        scope.ready();
    }

    /**
     * Handler for linkclick messages
     * @returns {void}
     * @private
     */
    function handleLinkClick(data) {
        var event = api.fire('linkclick', data);
        if (!event.isDefaultPrevented()) {
            if (data.uri) {
                window.open(data.uri);
            } else if (data.destination) {
                api.scrollTo(data.destination.pagenum);
            }
        }
    }

    /**
     * Enable or disable the dragger given the `isDraggable` flag
     * @param   {Boolean} isDraggable Whether or not the layout is draggable
     * @returns {void}
     * @private
     */
    function updateDragger(isDraggable) {
        if (isDraggable) {
            if (!dragger) {
                dom.addClass(viewerEl, CSS_CLASS_DRAGGABLE);
                dragger = scope.createComponent('dragger');
                dragger.init(config.viewportEl);
            }
        } else {
            if (dragger) {
                dom.removeClass(viewerEl, CSS_CLASS_DRAGGABLE);
                scope.destroyComponent(dragger);
                dragger = null;
            }
        }
    }

    /**
     * Validates and normalizes queryParams config option
     * @returns {void}
     */
    function validateQueryParams() {
        var queryString;
        if (config.queryParams) {
            if (typeof config.queryParams === 'string') {
                // strip '?' if it's there, because we add it below
                queryString = config.queryParams.replace(/^\?/, '');
            } else {
                queryString = util.param(config.queryParams);
            }
        }
        config.queryString = queryString ? '?' + queryString : '';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {

        messages: [
            'asseterror',
            'destroy',
            'dragend',
            'dragstart',
            'fail',
            'layoutchange',
            'linkclick',
            'pagefail',
            'pagefocus',
            'pageload',
            'pageunload',
            'ready',
            'resize',
            'scrollstart',
            'scrollend',
            'zoom'
        ],

        /**
         * Handle framework messages
         * @param {string} name The name of the message
         * @param {any} data The related data for the message
         * @returns {void}
         */
        onmessage: function (name, data) {
            switch (name) {
                case 'layoutchange':
                    api.updateLayout();
                    break;

                case 'linkclick':
                    handleLinkClick(data);
                    break;

                case 'zoom':
                    // artificially adjust the reported zoom to be accuate given the page scale
                    data.zoom *= config.pageScale;
                    data.prevZoom *= config.pageScale;
                    if (config.enableDragging) {
                        updateDragger(data.isDraggable);
                    }

                    // forward zoom event to external event handlers
                    api.fire(name, data);
                    break;

                case 'dragstart':
                    dom.toggleClass(viewerEl, CSS_CLASS_DRAGGING, true);
                    // forward zoom event to external event handlers
                    api.fire(name, data);
                    break;

                case 'dragend':
                    dom.toggleClass(viewerEl, CSS_CLASS_DRAGGING, false);
                    // forward zoom event to external event handlers
                    api.fire(name, data);
                    break;

                default:
                    // forward subscribed framework messages to external event handlers
                    api.fire(name, data);
                    break;
            }
        },

        /**
         * Initialize the viewer api
         * @returns {void}
         */
        init: function () {
            config = scope.getConfig();
            api = config.api;

            // create a unique CSS namespace for this viewer instance
            config.namespace = CSS_CLASS_VIEWER + '-' + config.id;

            // Setup container
            viewerEl = config.el;

            // add crocodoc viewer and namespace classes
            dom.addClass(viewerEl, CSS_CLASS_VIEWER);
            dom.addClass(viewerEl, config.namespace);

            // add a / to the end of the base url if necessary
            if (config.url) {
                if (!/\/$/.test(config.url)) {
                    config.url += '/';
                }
            } else {
                throw new Error('no URL given for viewer assets');
            }

            // make the url absolute
            config.url = scope.getUtility('url').makeAbsolute(config.url);

            validateQueryParams();
            initViewerHTML();
            initPlugins();
        },

        /**
         * Destroy the viewer-base component
         * @returns {void}
         */
        destroy: function () {
            // empty container and remove all class names that contain "crocodoc"
            dom.empty(viewerEl);
            dom.removeClass(viewerEl, function (i, cls) {
                var match = cls.match(new RegExp('crocodoc\\S+', 'g'));
                return match && match.join(' ');
            });

            // remove the stylesheet
            dom.remove(stylesheetEl);

            if (assetsPromise) {
                assetsPromise.abort();
            }
        },

        /**
         * Set the layout to the given mode, destroying and cleaning up the current
         * layout if there is one
         * @param  {string} layoutMode The layout mode
         * @returns {Layout} The layout object
         */
        setLayout: function (layoutMode) {
            // create a layout component with the new layout config
            var lastPage = config.page,
                lastZoom = config.zoom || 1,
                previousLayoutMode = config.layout,
                newLayout;

            // if there is already a layout, save some state
            if (layout) {
                // ignore this if we already have the specified layout
                if (layoutMode === previousLayoutMode) {
                    return layout;
                }

                lastPage = layout.state.currentPage;
                lastZoom = layout.state.zoomState;
            }

            newLayout = scope.createComponent('layout-' + layoutMode);
            if (!newLayout) {
                throw new Error('Invalid layout ' +  layoutMode);
            }

            // remove and destroy the existing layout component
            // @NOTE: this must be done after we decide if the
            // new layout exists!
            if (layout) {
                scope.destroyComponent(layout);
            }

            config.layout = layoutMode;

            layout = newLayout;
            layout.init();
            layout.setZoom(lastZoom.zoomMode || lastZoom.zoom || lastZoom);
            if (util.isFn(layout.scrollTo)) {
                layout.scrollTo(lastPage);
            }
            config.currentLayout = layout;

            scope.broadcast('layoutchange', {
                // in the context of event data, `layout` and `previousLayout`
                // are actually the name of those layouts, and not the layout
                // objects themselves
                previousLayout: previousLayoutMode,
                layout: layoutMode
            });
            return layout;
        },

        /**
         * Load the metadata and css for this document
         * @returns {void}
         */
        loadAssets: function () {
            var loadStylesheetPromise,
                loadMetadataPromise,
                pageOneContentPromise,
                pageOneTextPromise;

            if (assetsPromise) {
                return;
            }

            loadMetadataPromise = scope.get('metadata');
            loadMetadataPromise.then(function handleMetadataResponse(metadata) {
                config.metadata = metadata;
            });

            // only load the stylesheet if the text layer is used
            if (hacks.shouldUseTextLayer()) {
                loadStylesheetPromise = scope.get('stylesheet');
                loadStylesheetPromise.then(function handleStylesheetResponse(cssText) {
                    stylesheetEl = util.insertCSS(cssText);
                    config.stylesheet = stylesheetEl.sheet;
                });
            } else {
                stylesheetEl = util.insertCSS('');
                config.stylesheet = stylesheetEl.styleSheet;
                loadStylesheetPromise = promise.empty();
            }

            // load page 1 assets immediately if necessary
            if (config.autoloadFirstPage &&
                (!config.pageStart || config.pageStart === 1)) {

                // check if we're using svg or png
                if (!hacks.shouldUsePngFallback()) {
                    pageOneContentPromise = scope.get('page-svg', 1);
                } else if (config.conversionIsComplete) {
                    // unfortunately, page-1.png is not necessarily available
                    // on View API's document.viewable event, so we can only
                    // prefetch page-1.png if conversion is complete
                    pageOneContentPromise = scope.get('page-img', 1);
                }
                if (config.enableTextSelection) {
                    pageOneTextPromise = scope.get('page-text', 1);
                }
            }

            // when both metatadata and stylesheet are done or if either fails...
            assetsPromise = promise.when(loadMetadataPromise, loadStylesheetPromise)
                .fail(function (error) {
                    if (assetsPromise) {
                        assetsPromise.abort();
                    }
                    scope.ready();
                    scope.broadcast('asseterror', error);
                    scope.broadcast('fail', error);
                })
                .then(completeInit)
                .promise({
                    abort: function () {
                        assetsPromise = null;
                        loadMetadataPromise.abort();
                        loadStylesheetPromise.abort();
                        if (pageOneContentPromise) {
                            pageOneContentPromise.abort();
                        }
                        if (pageOneTextPromise) {
                            pageOneTextPromise.abort();
                        }
                    }
                });
        }
    };
});
