;
(function ($) {
    var DropDown = (function () {
        function DropDown($this, optionsParam) {
            this.arrowClass = 'i-arrow';
            var defaults = {
                containerTmpl: '<div class="i-dropdown-container"></div>',
                inputTmpl: '<input type="text" class="i-input-field"/>',
                arrowTmpl: "<span class=\"" + this.arrowClass + "\"></span>",
                listContainerTmpl: '<div class="i-list-container"></div>',
                listWraperTmpl: '<div class="i-list-wraper"></div>',
                listTmpl: '<div class="i-list"></div>',
                listItemTmpl: '<div class="i-list-item"></div>',
                pageCount: 50,
                thresholdPercent: 0,
                searchDelay: 300
            };
            var options = $.extend(defaults, optionsParam);
            this.$this = $this;
            this.options = options;
            this.state = {
                isOpen: false,
                isFocus: false,
                width: null,
                height: null,
                selectedValue: options.selectedValue || options.data[0].value,
                lastScrollTop: 0,
                indexSection: [0, options.pageCount],
                threshold: Math.ceil(options.pageCount * options.thresholdPercent),
                data: this.buildStateData(options.data, undefined),
                listItemHeight: options.listItemHeight || 30,
                searchDelayTimeoutId: null
            };
            this.initHtml();
        }
        DropDown.prototype.initHtml = function () {
            var options = this.options;
            var $this = this.$this;
            var width = $this.width();
            var height = $this.height();
            var margin = $this.css('margin');
            var container = $.parseHTML(options.containerTmpl);
            var input = $.parseHTML(options.inputTmpl);
            var arrow = $.parseHTML(options.arrowTmpl);
            var listContainer = $.parseHTML(options.listContainerTmpl);
            var listWraper = $.parseHTML(options.listWraperTmpl);
            var list = $.parseHTML(options.listTmpl);
            var $container = $(container);
            var $input = $(input);
            var $arrow = $(arrow);
            var $listContainer = $(listContainer);
            var $listWraper = $(listWraper);
            var $list = $(list);
            this.state.$dom = {
                $origin: $this,
                $container: $container,
                $input: $input,
                $arrow: $arrow,
                $listContainer: $listContainer,
                $listWraper: $listWraper,
                $list: $list
            };
            $listContainer.append(listWraper);
            $listWraper.append(list);
            $list.css('height', this.state.data.length * this.state.listItemHeight);
            $container.css({
                width: width + 'px',
                height: height + 'px',
                margin: margin
            }).append(input).append(arrow).append(listContainer);
            $this.after(container);
            $this.hide();
            $listContainer.hide();
            this.setCurrentItem(this.state.selectedValue);
            this.state.containerClickHandler = this.toggleOpen.bind(this);
            this.state.documentClickHandler = this.documentClick.bind(this);
            this.state.listScrollHandler = this.listScroll.bind(this);
            this.state.inputChangeHandler = this.inputChange.bind(this);
            $list.on('click', '.i-list-item', this.clickListItem.bind(this));
            $container.on('click', this.state.containerClickHandler);
            $(document).on('click', this.state.documentClickHandler);
            $listWraper.on('scroll', this.state.listScrollHandler);
            $input.on('input', this.state.inputChangeHandler);
        };
        DropDown.prototype.toggleOpen = function (e) {
            e.stopPropagation();
            var state = this.state;
            if (!state.isOpen) {
                this.state.data = this.buildStateData(this.options.data, undefined);
                this.state.$dom.$list.css('height', this.state.data.length * this.state.listItemHeight);
                this.buildListItems();
                this.open();
            }
            else {
                if (e.target.className !== this.arrowClass) {
                    return;
                }
                this.close();
            }
        };
        DropDown.prototype.open = function () {
            this.state.$dom.$listContainer.show();
            var lastScrollTop = this.state.listItemHeight * this.state.indexSection[0];
            this.state.$dom.$listWraper.scrollTop(lastScrollTop);
            this.state.lastScrollTop = lastScrollTop;
            this.state.isOpen = true;
        };
        DropDown.prototype.close = function () {
            this.state.$dom.$listContainer.hide();
            this.state.isOpen = false;
        };
        DropDown.prototype.buildListItems = function () {
            var data = this.state.data.slice(this.state.indexSection[0], this.state.indexSection[1]);
            this.state.$dom.$list.empty();
            for (var i = 0, len = data.length; i < len; i++) {
                var element = data[i];
                var $listItem = $($.parseHTML(this.options.listItemTmpl));
                $listItem.html(element.name).data('value', element.value).data('index', i).css({
                    height: this.state.listItemHeight,
                    top: element.index * this.state.listItemHeight
                });
                if (element.value === this.state.selectedValue) {
                    $listItem.addClass('active');
                }
                this.state.$dom.$list.append($listItem[0]);
            }
        };
        DropDown.prototype.clickListItem = function (e) {
            e.stopPropagation();
            var target = e.target;
            var value = $(target).data('value');
            this.setCurrentItem(value);
            this.close();
        };
        DropDown.prototype.setCurrentItem = function (value) {
            this.state.selectedValue = value;
            var filterItems = this.state.data.filter(function (x) {
                return x.value === value;
            });
            if (filterItems.length > 0) {
                var currentItem = filterItems[0];
                var index = currentItem.originalIndex;
                var wraperHeight = this.state.$dom.$listWraper.outerHeight();
                var maxLineItemCount = Math.ceil(wraperHeight / this.state.listItemHeight);
                if (index > this.options.data.length - maxLineItemCount) {
                    index = this.options.data.length - maxLineItemCount;
                }
                this.state.indexSection[0] = index;
                this.state.indexSection[1] = Math.min(this.options.data.length, index + this.options.pageCount);
                this.state.$dom.$input.val(currentItem.name).data('value', currentItem.value);
                this.state.$dom.$origin.val(currentItem.value).data('name', currentItem.name);
            }
        };
        DropDown.prototype.documentClick = function (e) {
            var state = this.state;
            if (state.isOpen) {
                state.$dom.$listContainer.hide();
                state.isOpen = false;
            }
        };
        DropDown.prototype.listScroll = function (e) {
            var scrollTop = e.target.scrollTop;
            var scrollPX = scrollTop - this.state.lastScrollTop;
            var direction = scrollPX > 0 ? 1 : -1;
            var scrollCount = Math.floor(Math.abs(scrollPX) / this.state.listItemHeight);
            if (scrollCount >= this.state.threshold) {
                var data = this.state.data;
                var i = Math.max(scrollCount - this.options.pageCount, this.state.threshold);
                for (; i < scrollCount; i++) {
                    var index = direction === 1 ? this.state.indexSection[1] + i : this.state.indexSection[0] - i - 1;
                    if (index >= data.length || index < 0) {
                        break;
                    }
                    var element = data[index];
                    var $listItem = $($.parseHTML(this.options.listItemTmpl));
                    $listItem.html(element.name).data('value', element.value).data('index', index).css({
                        height: this.state.listItemHeight,
                        top: element.index * this.state.listItemHeight
                    });
                    if (element.value === this.state.selectedValue) {
                        $listItem.addClass('active');
                    }
                    if (direction === 1) {
                        this.state.$dom.$list.append($listItem[0]);
                        this.state.$dom.$list.find('div:first').remove();
                    }
                    else {
                        this.state.$dom.$list.prepend($listItem[0]);
                        this.state.$dom.$list.find('div:last').remove();
                    }
                }
                this.state.indexSection = [
                    this.state.indexSection[0] + (i * direction),
                    this.state.indexSection[1] + (i * direction),
                ];
                this.state.lastScrollTop = this.state.lastScrollTop + (direction * scrollCount * this.state.listItemHeight);
            }
        };
        DropDown.prototype.buildStateData = function (data, key) {
            if (key === undefined || key.trim().length === 0) {
                return data.map(function (item, index) {
                    item.index = index;
                    item.originalIndex = index;
                    return item;
                });
            }
            var searchString = key.trim();
            var filteredData = [];
            for (var i = 0, j = 0, len = data.length; i < len; i++) {
                if (data[i].name.indexOf(searchString) > -1) {
                    data[i].index = j;
                    data[i].originalIndex = i;
                    filteredData.push(data[i]);
                    j++;
                }
            }
            return filteredData;
        };
        DropDown.prototype.inputChange = function (e) {
            var value = e.target.value;
            if (!this.state.isOpen) {
                this.open();
            }
            if (this.state.searchDelayTimeoutId !== null) {
                clearTimeout(this.state.searchDelayTimeoutId);
            }
            this.state.searchDelayTimeoutId = setTimeout(this.handleInputChange.bind(this), this.options.searchDelay, value);
        };
        DropDown.prototype.handleInputChange = function (value) {
            this.state.data = this.buildStateData(this.options.data, value);
            this.state.indexSection = [0, this.options.pageCount];
            this.state.lastScrollTop = 0;
            this.state.selectedValue = null;
            this.state.$dom.$origin.val('').data('name', '');
            this.state.$dom.$input.data('value', '');
            this.buildListItems();
            var lastScrollTop = this.state.listItemHeight * this.state.indexSection[0];
            this.state.$dom.$listWraper.scrollTop(lastScrollTop);
            this.state.lastScrollTop = lastScrollTop;
            this.state.$dom.$list.css('height', this.state.data.length * this.state.listItemHeight);
        };
        DropDown.prototype.destory = function () {
            $(document).off('click', this.state.documentClickHandler);
        };
        return DropDown;
    }());
    $.fn.extend({
        dropdown: function (options) {
            return new DropDown(this, options);
        }
    });
})(jQuery);
