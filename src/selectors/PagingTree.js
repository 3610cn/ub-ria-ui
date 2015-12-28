/**
 * UB-RIA-UI 1.0
 * Copyright 2015 Baidu Inc. All rights reserved.
 *
 * @ignore
 * @file 分页树控件
 * @author chenhaoyin(chenhaoyin@baidu.com)
 */
define(
    function (require) {
        var Control = require('esui/Control');
        var lib = require('esui/lib');
        var u = require('underscore');
        var painters = require('esui/painters');

        var TreeStrategy = require('./PagingSelectorTreeStrategy');

        /**
         * 不做任何事的`TreeStrategy`实现
         *
         * @extends TreeStrategy
         * @ignore
         */
        var nullTreeStrategyExports = {};

        /**
         * 不做任何事
         *
         * @override
         * @ignore
         */
        nullTreeStrategyExports.attachTo = function () {};
        var NullTreeStrategy = require('eoo').create(TreeStrategy, nullTreeStrategyExports);


        /**
         * 树控件
         *
         * @extends Control
         * @constructor
         */
        var exports = {};

        /**
         * 控件类型，始终为`"Tree"`
         *
         * @type {string}
         * @readonly
         * @override
         */
        exports.type = 'PagingTree';

        exports.styleType = 'Tree';

        /**
         * @cfg defaultProperties
         *
         * 默认属性值
         *
         * @cfg {boolean} [defaultProperties.selectMode="single"] 默认选择模式
         * @cfg {boolean} [defaultProperties.hideRoot=false] 默认是否隐藏根节点
         * @static
         */
        var defaultProperties = {
            selectMode: 'single',
            hideRoot: false
        };

        /**
         * 初始化参数
         *
         * @param {Object} [options] 构造函数传入的参数
         * @protected
         * @override
         */
        exports.initOptions = function (options) {
            var defaults = {
                datasource: {},
                /**
                 * @property {TreeStrategy} [strategy]
                 *
                 * 树关联的{@link TreeStrategy}对象
                 *
                 * 树默认不采取任何行为，均委托给`strategy`处理，
                 * 具体参考{@link TreeStrategy}的说明
                 *
                 * 如果不提供此参数，则树不会有展开、收起、选中、反选等交互
                 *
                 * @protected
                 */
                strategy: new NullTreeStrategy(),
                /**
                 * @property {meta.TreeItem[]} selectedNodes
                 *
                 * 已选中的节点
                 *
                 * @protected
                 */
                selectedNodes: [],
                /**
                 * @property {Object} selectedNodeIndex
                 *
                 * 已选中的节点根据id的索引
                 *
                 * @protected
                 */
                selectedNodeIndex: {}
            };
            var properties = lib.extend(defaults, defaultProperties, options);
            if (properties.allowUnselectNode == null) {
                // 默认单选模式下不允许取消选择，多选则可以取消
                /**
                 * @property {boolean} allowUnselectNode
                 *
                 * 指定是否允许将选中的节点取消选择，仅影响通过鼠标点击的操作，
                 * 对{@link Tree#unselectNode}没有影响
                 */
                properties.allowUnselectNode = (properties.selectMode !== 'single');
            }
            this.setProperties(properties);
        };

        /**
         * 每个节点显示的内容的模板
         *
         * 在模板中可以使用以下占位符：
         *
         * - `{string} text`：文本内容，经过HTML转义
         *
         * @type {string}
         */
        exports.itemTemplate = '<span>${text}</span>';

        exports.moreTemplate = '<span>加载更多</span>';

        /**
         * 获取每个节点显示的内容
         *
         * @param {meta.TreeItem} node 节点数据
         * @return {string} 节点的HTML片段
         */
        exports.getItemHTML = function (node) {
            var data = {
                id: lib.encodeHTML(node.id),
                text: lib.encodeHTML(node.text)
            };
            return lib.format(this.itemTemplate, data);
        };

        var INDICATOR_TEXT_MAPPING = {
            collapsed: '展开',
            expanded: '收起',
            busy: '加载中',
            empty: '无内容'
        };

        /**
         * 获取指示器（节点文字前的那个图标）的HTML
         *
         * @param {Tree} tree 控件实例
         * @param {meta.TreeItem} node 节点数据
         * @param {string} type 指示器的类型，为`empty`、`expanded`或`collapsed`
         * @param {number} currentLevel 当前指示器代表的层级
         * @param {number} sourceLevel 节点所在的层级
         * @return {string}
         * @ignore
         */
        function getIndicatorHTML(tree, node, type, currentLevel, sourceLevel) {
            var diff = sourceLevel - currentLevel;
            var diffType = diff === 0
                ? 'current'
                : (diff === 1 ? 'previous' : 'far-previous');
            var classes = [].concat(
                tree.helper.getPartClasses('node-indicator'),
                tree.helper.getPartClasses('node-indicator-' + type),
                tree.helper.getPartClasses('node-indicator-level-' + currentLevel),
                tree.helper.getPartClasses('node-indicator-' + diffType)
            );
            var text = diff === 0
                ? INDICATOR_TEXT_MAPPING[type || 'collapsed']
                : '第' + currentLevel + '级';
            var html = '<span ';
            if (diff === 0) {
                html += 'id="' + tree.helper.getId('indicator-' + node.id) + '" ';
            }
            html += 'class="' + classes.join(' ') + '">' + text + '</span>';
            return html;
        }

        /**
         * 获取节点的内容HTML
         *
         * @param {Tree} tree 控件实例
         * @param {meta.TreeItem} node 节点数据
         * @param {number} level 节点的层级，根是0层
         * @param {boolean} expanded 是否处于展开状态
         * @return {string}
         * @ignore
         */
        function getNodeContentHTML(tree, node, level, expanded) {
            var wrapperClasses = tree.helper.getPartClasses('content-wrapper');
            if (tree.selectedNodeIndex[node.id]) {
                wrapperClasses = wrapperClasses.concat(
                    tree.helper.getPartClasses('content-wrapper-selected')
                );
            }

            if (node.disabled) {
                wrapperClasses = wrapperClasses.concat(
                    tree.helper.getPartClasses('content-wrapper-disabled')
                );
            }

            var wrapperId = tree.helper.getId('content-wrapper-' + node.id);

            var indicatorHtml = '';
            var indicatorType = tree.strategy.isLeafNode(node)
                ? 'empty'
                : (expanded ? 'expanded' : 'collapsed');
            for (var i = 0; i <= level; i++) {
                indicatorHtml += getIndicatorHTML(tree, node, indicatorType, i, level);
            }

            var itemWrapperClasses = tree.helper.getPartClasses('item-content');

            var tpl = '<div id="${wrapperId}" class="${wrapperClasses}">'
                + '${indicatorHtml}<div class="${itemWrapperClasses}">${itemHtml}</div></div>';

            var html = lib.format(
                tpl,
                {
                    wrapperId: wrapperId,
                    wrapperClasses: wrapperClasses.join(' '),
                    indicatorHtml: indicatorHtml,
                    itemWrapperClasses: itemWrapperClasses.join(' '),
                    itemHtml: tree.getItemHTML(node)
                }
            );

            if (expanded && !tree.strategy.isLeafNode(node)) {
                var classes = [].concat(
                    tree.helper.getPartClasses('sub-root'),
                    tree.helper.getPartClasses('sub-root-' + indicatorType)
                );
                html += '<ul class="' + classes.join(' ') + '">';
                if (node.children) {
                    for (var j = 0; j < node.children.results.length; j++) {
                        var child = node.children.results[j];
                        var flag = child.children && child.children.results;
                        html += getNodeHTML(
                            tree,
                            child,
                            level + 1,
                            flag
                        );
                    }
                }

                if (tree.strategy.hasMoreFlag(node)) {
                    var nodeList = node.children.results;
                    var lastNode = nodeList[nodeList.length - 1];
                    html += getMoreNodeHtml(tree, lastNode, i, level + 1);
                }
                html += '</ul>';
            }

            return html;
        }

        function getMoreNodeHtml(tree, node, i, level, nodeName) {
            if (!node) {
                return '';
            }
            nodeName = nodeName || 'li';
            var classes = getNodeClasses(tree, node, level, false);

            var tpl = '<${nodeName} class="${classes}" id="${id}" data-id="${nodeId}" data-level="${level}">'
                + '${content}</${nodeName}>';

            return lib.format(
                tpl,
                {
                    nodeName: nodeName,
                    classes: classes.join(' '),
                    id: tree.helper.getId('node-row-more' + node.id),
                    nodeId: node.id,
                    level: level,
                    content: getMoreContent(tree, node, i, level)
                }
            );
        }

        function getMoreContent(tree, node, i, level) {
            var wrapperClasses = tree.helper.getPartClasses('content-wrapper');

            wrapperClasses = wrapperClasses.concat(tree.helper.getPartClasses('content-wrapper-row-more'));

            var wrapperId = tree.helper.getId('content-wrapper-' + node.id);

            var indicatorHtml = '';
            var indicatorType = 'empty';
            for (var j = 0; j <= level; j++) {
                indicatorHtml += getIndicatorHTML(tree, node, indicatorType, j, level);
            }

            var itemWrapperClasses = tree.helper.getPartClasses('item-content');

            var tpl = '<div id="${wrapperId}" class="${wrapperClasses}">'
                + '${indicatorHtml}<div class="${itemWrapperClasses}">${moreContent}</div></div>';

            return lib.format(
                tpl,
                {
                    wrapperId: wrapperId,
                    wrapperClasses: wrapperClasses.join(' '),
                    indicatorHtml: indicatorHtml,
                    itemWrapperClasses: itemWrapperClasses.join(' '),
                    moreContent: tree.moreTemplate
                }
            );
        }

        /**
         * 获取一个节点元素应有的class
         *
         * @param {Tree} tree 控件实例
         * @param {meta.TreeItem} node 对应的节点数据
         * @param {number} level 节点的层极，根是0层
         * @param {boolean} expanded 是否处于展开状态
         * @return {string[]} 对应的节点元素应有的class
         * @ignore
         */
        function getNodeClasses(tree, node, level, expanded) {
            var state = tree.strategy.isLeafNode(node)
                ? 'empty'
                : (expanded ? 'expanded' : 'collapsed');
            var classes = [].concat(
                tree.helper.getPartClasses('node'),
                tree.helper.getPartClasses('node-' + state),
                tree.helper.getPartClasses('node-level-' + level)
            );
            // 根节点再加2个类
            if (node === tree.datasource) {
                classes = [].concat(
                    tree.helper.getPartClasses('root'),
                    tree.helper.getPartClasses('root-' + state),
                    classes
                );
            }
            return classes;
        }

        /**
         * 获取节点的HTML
         *
         * @param {Tree} tree 控件实例
         * @param {meta.TreeItem} node 节点数据
         * @param {number} level 节点的层级，根是0层
         * @param {boolean} expanded 是否处于展开状态
         * @param {string} [nodeName="li"] 使用节点的类型
         * @return {string}
         * @ignore
         */
        function getNodeHTML(tree, node, level, expanded, nodeName) {
            nodeName = nodeName || 'li';
            var flag = node.children && node.children.results;
            var classes = getNodeClasses(tree, node, level, flag);

            var tpl = '<${nodeName} class="${classes}" id="${id}" data-id="${nodeId}" data-level="${level}">'
                + '${nodeContent}</${nodeName}>';

            return lib.format(
                tpl,
                {
                    nodeName: nodeName,
                    classes: classes.join(' '),
                    id: tree.helper.getId('node-' + node.id),
                    nodeId: node.id,
                    level: level,
                    nodeContent: getNodeContentHTML(tree, node, level, expanded)
                }
            );
        }

        /**
         * 根据节点的当前状态展开或收起节点
         *
         * @param {Event} e DOM事件对象
         * @ignore
         */
        function toggleAndSelectNode(e) {
            // 对于树控件来说，只有点在`.content-wrapper`上才是有效的，
            // 而`.content-wrapper`下只有2类元素：
            //
            // - 提示元素，有`ui-tree-node-indicator`这个class，且没有子元素
            // - 内容元素，有`ui-tree-item-content`这个class，内容未知
            //
            // 因此，首先判断是否点在提示元素上，如果不是则向上找看是不是能到wrapper
            var target = e.target;
            var indicatorClass = this.helper.getPartClasses('node-indicator')[0];
            var isValidToggleEvent = lib.hasClass(target, indicatorClass);

            // 点在`indicator`上时不触发选中逻辑，只负责展开/收起
            var isValidSelectEvent = false;
            var isValidLoadMoreEvent = false;
            var disabled = false;

            if (!isValidToggleEvent) {
                var wrapperClass = this.helper.getPartClasses('content-wrapper')[0];
                var loadMoreClass = this.helper.getPartClasses('content-wrapper-row-more');
                var disabledClass = this.helper.getPartClasses('content-wrapper-disabled');

                while (target
                    && target !== this.main
                    && !lib.hasClass(target, wrapperClass)
                ) {
                    target = target.parentNode;
                }

                // 这行不准被选择（但是可以展开收起）
                if (lib.hasClass(target, disabledClass)) {
                    disabled = true;
                }


                // 点在加载更多上
                if (lib.hasClass(target, loadMoreClass)) {
                    isValidLoadMoreEvent = true;
                }
                else if (lib.hasClass(target, wrapperClass)) {
                    isValidToggleEvent = this.wideToggleArea;
                    isValidSelectEvent = !isValidToggleEvent;
                }
            }

            if (!isValidToggleEvent && !isValidSelectEvent && !isValidLoadMoreEvent) {
                return;
            }

            // 往上找到树的节点，有`data-id`等有用的属性
            while (target
                && target !== this.main
                && !lib.hasAttribute(target, 'data-id')
            ) {
                target = target.parentNode;
            }
            var id = target.getAttribute('data-id');

            if (isValidLoadMoreEvent) {
                this.triggerLoadMoreEvent(id);
            }

            if (isValidToggleEvent) {
                this.triggerToggleStrategy(id);
            }

            if (isValidSelectEvent && !disabled) {
                this.triggerSelectStrategy(id);
            }
        }

        exports.addExpandedNodeStatus = function (id) {
            var nodeElement = lib.g(this.helper.getId('node-' + id));
            var childLoadedClass = this.helper.getPartClasses('node-child-loaded');
            lib.addClass(nodeElement, childLoadedClass);
        };

        /**
         * 点击节点事件处理函数
         *
         * @param {Event} e DOM事件对象
         * @protected
         */
        exports.clickNode = function (e) {
            toggleAndSelectNode.apply(this, arguments);
        };

        /**
         * 初始化DOM结构
         *
         * @protected
         * @override
         */
        exports.initStructure = function () {
            this.strategy.attachTo(this);
        };

        /**
         * 初始化事件交互
         *
         * @protected
         * @override
         */
        exports.initEvents = function () {
            this.helper.addDOMEvent(this.main, 'click', this.clickNode);
        };

        /**
         * 构建节点的id->数据的索引
         *
         * @param {meta.TreeItem} node 节点数据，第一次调用时为根
         * @param {Object} [index] 用于存放索引的对象，第一次调用时不传递
         * @return {Object}
         * @ignore
         */
        function buildNodeIndex(node, index) {
            index = index || {};

            index[node.id] = node;
            if (node.children) {
                for (var i = 0; i < node.children.results.length; i++) {
                    buildNodeIndex(node.children.results[i], index);
                }
            }

            return index;
        }

        /**
         * 从索引中移除一个节点
         *
         * @param {string} id 节点的id
         * @protected
         */
        exports.removeNodeFromIndex = function (id) {
            var node = this.nodeIndex[id];

            if (!node) {
                return;
            }

            this.nodeIndex[id] = undefined;

            if (!node.children) {
                return;
            }

            // 需要把子节点也移掉
            u.each(node.children, this.removeNodeFromIndex, this);
        };

        /**
         * 重渲染
         *
         * @method
         * @protected
         * @override
         */
        exports.repaint = painters.createRepaint(
            Control.prototype.repaint,
            {
                /**
                 * @property {meta.TreeItem[]} datasource
                 *
                 * 数据源
                 */
                name: 'datasource',
                paint: function (tree, datasource) {
                    tree.selectedNodes = [];
                    tree.selectedNodeIndex = {};
                    tree.nodeIndex = buildNodeIndex(datasource);
                    tree.main.innerHTML = getNodeHTML(tree, datasource, 0, true, 'div');
                }
            },
            {
                /**
                 * @property {boolean} hideRoot
                 *
                 * 是否隐藏根节点，隐藏根节点后看上去更像一个多级的列表
                 */
                name: 'hideRoot',
                paint: function (tree, hideRoot) {
                    var method = hideRoot ? 'addState' : 'removeState';
                    tree[method]('hide-root');
                }
            }
        );

        /**
         * 触发选中或取消选中节点的策略
         *
         * @param {string} id 节点的id
         */
        exports.triggerSelectStrategy = function (id) {
            var node = this.nodeIndex[id];

            if (!node) {
                return;
            }

            if (this.selectedNodeIndex[id]) {
                /**
                 * @event unselect
                 *
                 * 一个节点被指定取消选择触发，事件之后不会做任何操作
                 *
                 * @param {meta.TreeItem} node 指定取消选择的节点
                 */
                this.fire('unselect', {node: node});
            }
            else {
                /**
                 * @event select
                 *
                 * 一个节点被指定选中触发，事件之后不会做任何操作
                 *
                 * @param {meta.TreeItem} node 指定选中的节点
                 */
                this.fire('select', {node: node});
            }
        };

        /**
         * 获取选中的节点集合
         *
         * @return {meta.TreeItem[]}
         */
        exports.getSelectedNodes = function () {
            return this.selectedNodes.slice();
        };

        /**
         * 添加选中节点
         *
         * @param {Tree} tree 控件实例
         * @param {meta.TreeItem} node 节点数据项
         * @return {boolean} 添加是否成功
         * @ignore
         */
        function addSelectedNode(tree, node) {
            if (tree.selectedNodeIndex[node.id]) {
                return false;
            }

            tree.selectedNodes.push(node);
            tree.selectedNodeIndex[node.id] = node;
            return true;
        }

        /**
         * 移除选中节点
         *
         * @param {Tree} tree 控件实例
         * @param {meta.TreeItem} node 节点数据项
         * @return {boolean} 移除是否成功
         * @ignore
         */
        function removeSelectedNode(tree, node) {
            if (tree.selectedNodeIndex[node.id]) {
                delete tree.selectedNodeIndex[node.id];
                for (var i = 0; i < tree.selectedNodes.length; i++) {
                    if (tree.selectedNodes[i] === node) {
                        tree.selectedNodes.splice(i, 1);
                    }
                }
                return true;
            }
            return false;
        }

        /**
         * 更换节点的选中状态
         *
         * @param {string} id 节点的id
         */
        exports.toggleNodeSelection = function (id) {
            var method = this.selectedNodeIndex[id]
                ? 'unselectNode'
                : 'selectNode';
            this[method](id);
        };

        /**
         * 取消节点选中
         *
         * @param {Tree} tree 控件实例
         * @param {string} id 节点id
         * @param {Object} options 相关配置项
         * @param {boolean} options.force 强制移除（无视`allowUnselectNode`配置）
         * @param {boolean} options.silent 是否静默处理（不触发事件）
         * @param {boolean} options.modifyDOM 是否对DOM节点做处理
         * @ignore
         */
        function unselectNode(tree, id, options) {
            // 虽然这个`force`所有调用地方都是`true`了，但可能以后还会有用吧，先留着算了
            if (!options.force && !tree.allowUnselectNode) {
                return;
            }

            var node = tree.nodeIndex[id];

            if (!node) {
                return;
            }

            var removed = removeSelectedNode(tree, node);

            if (removed) {
                if (options.modifyDOM) {
                    var nodeElement = lib.g(tree.helper.getId('content-wrapper-' + id));
                    tree.helper.removePartClasses('content-wrapper-selected', nodeElement);
                }

                if (!options.silent) {
                    /**
                     * @event unselectnode
                     *
                     * 一个节点被取消选中时触发
                     *
                     * @param {meta.TreeItem} node 取消选中的节点
                     * @member Tree
                     */
                    tree.fire('unselectnode', {node: node});
                    tree.fire('selectionchange');
                }
            }
        }

        /**
         * 选中一个节点
         *
         * @param {string} id 节点id
         * @param {boolean} [silent=false] 是否禁止触发事件
         * @fires selectnode
         * @fires selectionchange
         */
        exports.selectNode = function (id, silent) {
            var node = this.nodeIndex[id];

            if (!node) {
                return;
            }

            var added = addSelectedNode(this, node);
            if (!added) {
                return;
            }

            // 只能选一个的话，新选中的肯定在后面，因此把第1个删掉就行
            if (this.selectMode === 'single' && this.selectedNodes.length > 1) {
                unselectNode(
                    this,
                    this.selectedNodes[0].id,
                    {force: true, silent: true, modifyDOM: true}
                );
            }
            var nodeElement = lib.g(this.helper.getId('content-wrapper-' + id));
            this.helper.addPartClasses('content-wrapper-selected', nodeElement);

            if (!silent) {
                /**
                 * @event selectnode
                 *
                 * 一个节点被选中时触发
                 *
                 * @param {meta.TreeItem} node 选中的节点
                 */
                this.fire('selectnode', {node: node});
                /**
                 * @event selectionchange
                 *
                 * 选中节点变化时触发
                 *
                 * 始终在{@link Tree#selectnode}
                 * 和{@link Tree#unselectnode}事件之后触发
                 */
                this.fire('selectionchange');
            }
        };

        /**
         * 取消一个节点的选中状态
         *
         * @param {string} id 节点id
         * @param {boolean} [silent=false] 是否禁止触发事件
         * @fires unselectnode
         */
        exports.unselectNode = function (id, silent) {
            unselectNode(
                this,
                id,
                {force: true, silent: silent, modifyDOM: true}
            );
        };

        /**
         * 向指定节点填充子节点并展开节点
         *
         * @param {string} id 节点的id
         * @param {meta.TreeItem[]} children 子节点数据，如果不提供此参数，
         * 则控件按照以下逻辑执行：
         *
         * - 如果原本已经有子树的元素，则直接展开
         * - 如果原本没有子树元素，则取对应节点的`children`属性创建子树
         */
        exports.expandNode = function (id, children) {
            var nodeElement = lib.g(this.helper.getId('node-' + id));

            if (!nodeElement) {
                return;
            }

            var level = +lib.getAttribute(nodeElement, 'data-level');
            // 更新过数据或者原本没有子树的情况下重绘
            if (children
                || nodeElement.lastChild.nodeName.toLowerCase() !== 'ul'
            ) {
                var node = this.nodeIndex[id];
                if (!node) {
                    return;
                }
                if (children) {
                    // 如果是用来替换原来的子节点，那要先把原来的子节点从索引中去掉
                    if (node.children) {
                        for (var i = 0; i < node.children.length; i++) {
                            unselectNode(
                                this,
                                node.children[i].id,
                                {force: true, silent: true, modifyDOM: false}
                            );
                            this.removeNodeFromIndex(node.children[i].id);
                        }
                    }
                    node.children = children;
                    // 重新索引
                    buildNodeIndex(node, this.nodeIndex);
                }

                // 为了效率，直接刷掉原来的HTML
                nodeElement.innerHTML = getNodeContentHTML(this, node, level, true);
            }
            else {
                // 需要修改`indicator`的字样和class
                var indicator = lib.g(this.helper.getId('indicator-' + id));
                indicator.innerHTML = INDICATOR_TEXT_MAPPING.expanded;
                var indicatorClasses = [].concat(
                    this.helper.getPartClasses('node-indicator'),
                    this.helper.getPartClasses('node-indicator-level-' + level),
                    this.helper.getPartClasses('node-indicator-current'),
                    this.helper.getPartClasses('node-indicator-expanded')
                );
                indicator.className = indicatorClasses.join(' ');
                // 子树的class要改掉
                var rootClasses = [].concat(
                    this.helper.getPartClasses('sub-root'),
                    this.helper.getPartClasses('sub-root-expanded')
                );
                nodeElement.lastChild.className = rootClasses.join(' ');
            }

            // CSS3动画可以通过这个class来操作
            node = this.nodeIndex[id];
            var nodeClasses = getNodeClasses(this, node, level, true);
            nodeElement.className = nodeClasses.join(' ');
        };

        /**
         * 收起指定节点
         *
         * @param {string} id 节点的id
         * @param {boolean} [removeChild=false] 是否把子节点删除
         */
        exports.collapseNode = function (id, removeChild) {
            var nodeElement = lib.g(this.helper.getId('node-' + id));

            if (!nodeElement) {
                return;
            }

            var node = this.nodeIndex[id];
            var childRoot = nodeElement.getElementsByTagName('ul')[0];
            if (childRoot) {
                if (removeChild) {
                    childRoot.parentNode.removeChild(childRoot);
                    // 同时如果有选中的节点，要从选中集合中移除
                    if (node.children) {
                        for (var i = 0; i < node.children.length; i++) {
                            unselectNode(
                                this,
                                node.children[i].id,
                                {force: true, silent: false, modifyDOM: false}
                            );
                        }
                    }
                }
                else {
                    var rootClasses = [].concat(
                        this.helper.getPartClasses('sub-root'),
                        this.helper.getPartClasses('sub-root-collapsed')
                    );
                    childRoot.className = rootClasses.join(' ');
                }
            }

            var level = +lib.getAttribute(nodeElement, 'data-level');
            var nodeClasses = getNodeClasses(this, node, level, false);
            // 既然能收起，表明已经展开过
            var childLoadedClass = this.helper.getPartClasses('node-child-loaded');
            nodeClasses.push(childLoadedClass);
            nodeElement.className = nodeClasses.join(' ');
            var indicator = lib.g(this.helper.getId('indicator-' + id));
            var indicatorClasses = [].concat(
                this.helper.getPartClasses('node-indicator'),
                this.helper.getPartClasses('node-indicator-level-' + level),
                this.helper.getPartClasses('node-indicator-current'),
                this.helper.getPartClasses('node-indicator-collapsed')
            );
            indicator.className = indicatorClasses.join(' ');
            indicator.innerHTML = INDICATOR_TEXT_MAPPING.collapsed;
        };

        /**
         * 判断一个节点是否为空
         *
         * @param {Tree} tree 控件实例
         * @param {HTMLElement} nodeElement 节点对应的DOM元素
         * @return {boolean}
         * @ignore
         */
        function isEmpty(tree, nodeElement) {
            var className = tree.helper.getPartClasses('node-empty')[0];
            return lib.hasClass(nodeElement, className);
        }

        /**
         * 判断一个节点是否展开
         *
         * @param {Tree} tree 控件实例
         * @param {HTMLElement} nodeElement 节点对应的DOM元素
         * @return {boolean}
         * @ignore
         */
        function isExpanded(tree, nodeElement) {
            // TODO: 放出来给子类用
            var className = tree.helper.getPartClasses('node-expanded')[0];
            return lib.hasClass(nodeElement, className);
        }

        /**
         * 根据节点的状态展开或收起节点
         *
         * @param {string} id 节点的id
         * @param {meta.TreeItem[]} children 子节点数据，
         * 参考{@link Tree#expandNode}方法的相关说明
         * @param {boolean} removeChild 是否把子节点删除，
         * 参考{@link Tree#collapseNode}方法的相关说明
         */
        exports.toggleNode = function (id, children, removeChild) {
            if (!this.nodeIndex[id]) {
                return;
            }

            var nodeElement = lib.g(this.helper.getId('node-' + id));

            if (!nodeElement) {
                return;
            }

            if (isEmpty(this, nodeElement)) {
                return;
            }

            if (isExpanded(this, nodeElement)) {
                this.collapseNode(id, removeChild);
            }
            else {
                this.expandNode(id, children);
            }
        };

        exports.triggerLoadMoreEvent = function (id) {
            var node = this.nodeIndex[id];
            if (!node) {
                return;
            }
            this.fire('loadmoredata', {node: node});
        };

        /**
         * 触发展开或收起节点的策略
         *
         * 与{@link Tree#toggleNode}不同，该方法用来根据节点的状态，
         * 触发{@link Tree#expand}或{@link Tree#collapse}事件，
         * 以便使用{@link TreeStrategy}进行具体的策略
         *
         * 在关联的{@link TreeStrategy}以外的逻辑，推荐使用此方法，
         * 而不是{@link Tree#toggleNode}
         *
         * @param {string} id 节点的id
         * @fires expand
         * @fires collapse
         */
        exports.triggerToggleStrategy = function (id) {
            var node = this.nodeIndex[id];

            if (!node) {
                return;
            }

            var nodeElement = lib.g(this.helper.getId('node-' + id));

            if (!nodeElement) {
                return;
            }

            if (isEmpty(this, nodeElement)) {
                return;
            }

            if (isExpanded(this, nodeElement)) {
                /**
                 * @event collapse
                 *
                 * 一个节点被指定收起时触发，事件之后不会做任何操作
                 *
                 * @param {meta.TreeItem} node 指定收起的节点
                 */
                this.fire('collapse', {node: node});
            }
            else {
                // 如果点开过，直接显示
                // 否则后端加载
                var childLoadedClass = this.helper.getPartClasses('node-child-loaded');

                var isRemote = !lib.hasClass(nodeElement, childLoadedClass);
                /**
                 * @event expand
                 *
                 * 一个节点被指定展开时触发，事件之后不会做任何操作
                 *
                 * @param {meta.TreeItem} node 展开的节点
                 */
                this.fire('expand', {node: node, remote: isRemote});
            }
        };

        /**
         * 修改指定节点为正在加载数据的繁忙状态
         *
         * @param {string} id 节点的id
         */
        exports.indicateNodeLoading = function (id) {
            var nodeElement = lib.g(this.helper.getId('node-' + id));
            if (!nodeElement) {
                return;
            }

            // 一个节点会对应多个`indicator`元素，在内容元素前面的全是`indicator`元素，
            // 其`level`从`0`开始递增，但只需要修改最后一个的样式就行了
            var children = lib.getChildren(nodeElement);
            var level = 0;
            while (!this.helper.isPart(children[level], 'item-content')) {
                level++;
            }

            var indicator = children[level];
            indicator.innerHTML = INDICATOR_TEXT_MAPPING.busy;
            var classes = [].concat(
                this.helper.getPartClasses('node-indicator'),
                this.helper.getPartClasses('node-indicator-level-' + level),
                this.helper.getPartClasses('node-indicator-current'),
                this.helper.getPartClasses('node-indicator-busy')
            );
            indicator.className = classes.join(' ');
        };

        exports.appendDatasource = function (datasource, targetId) {
            var baseId = this.helper.getId('node-row-more' + targetId);
            var moreControl = lib.g(baseId);

            var level = +lib.getAttribute(moreControl, 'data-level');

            var dom = document.createElement('ul');
            u.each(
                datasource.results,
                function (item) {
                    var content = getNodeHTML(this, item, level, false);
                    dom.innerHTML = content;
                    var appendNode = dom.childNodes[0];
                    appendNode && lib.insertBefore(appendNode, moreControl);
                    buildNodeIndex(item, this.nodeIndex);
                },
                this
            );

            if (datasource.moreFlag) {
                var lastDataId = datasource.results[datasource.results.length - 1].id;
                lib.setAttribute(moreControl, 'data-id', lastDataId);
                lib.setAttribute(moreControl, 'id', this.helper.getId('node-row-more' + lastDataId));
                var loadMoreClasses = this.helper.getPartClassName('row-loading');
                lib.removeClass(moreControl, loadMoreClasses);
            }
            else {
                lib.removeNode(moreControl);
            }
        };

        /**
         * 销毁控件
         *
         * @protected
         * @override
         */
        exports.dispose = function () {
            this.$super(arguments);
            this.nodeIndex = null;
            this.selectedNodes = null;
            this.selectedNodeIndex = null;
        };

        var Tree = require('eoo').create(Control, exports);

        require('esui').register(Tree);
        return Tree;
    }
);
