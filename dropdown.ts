/**
 * 传入的配置
 */
interface Options {
  containerTmpl: string;
  inputTmpl: string;
  arrowTmpl: string;
  listContainerTmpl: string;
  listWraperTmpl: string;
  listTmpl: string;
  listItemTmpl: string;
  data: Array<DataItem>;
  selectedValue: string;
  pageCount: number;
  thresholdPercent: number; // 滚动多少个数据才处理，为 (0,1] 的小数 , 用这个值乘以 pageCount 再向上取整就是真实的值
  searchDelay: number; // 输入框键入新值后延迟多久开始搜索，毫秒
  listItemHeight?: number;
  onDataRequestSuccess?:Function;
  onSetSelectValue?:Function;
  onUnsetSelectValue?:Function;
}
interface StateDom {
  $container: JQuery<HTMLElement>;
  $input: JQuery<HTMLElement>;
  $arrow: JQuery<HTMLElement>;
  $listContainer: JQuery<HTMLElement>;
  $listWraper: JQuery<HTMLElement>;
  $list: JQuery<HTMLElement>;

}

interface State {
  isOpen: boolean; // 是否展开
  isFocus: boolean; // 是否聚焦
  isChange:boolean; // 自从上次关闭后数据是否有变动
  width: number; // 原组件的宽度
  height: number; // 原组件的高度
  selectedValue: string;
  inputString:string; // 输入框中的文本
  lastScrollTop: number;
  threshold: number; // 滚动多少个数据才处理 , option 里的百分比计算得出来的值
  listItemHeight?: number;
  indexSection: [number, number];
  data: Array<DataItem>;
  arrowClickHandler?: (event: JQuery.ClickEvent) => void;
  documentClickHandler?: (event: JQuery.ClickEvent) => void;
  listScrollHandler?: (event: JQuery.ScrollEvent) => void;
  inputClickHandler?: (event: JQuery.ClickEvent) => void;
  inputChangeHandler?: (event: JQuery.ChangeEvent) => void;
  listItemClickHandler?: (event: JQuery.ClickEvent) => void;
  $dom?: StateDom;
  searchDelayTimeoutId?: number;
}

/**
 * 数据项
 */
interface DataItem {
  name: string; // 显示项
  id: string; // 值项
  index?: number; // 索引,过滤后的索引
  originalIndex?: number; // 原索引
}

; (function ($) {
  class DropDown {
    readonly containerClass: string = 'i-dropdown-container';
    readonly inputClass: string = 'i-input-field';
    readonly arrowClass: string = 'i-arrow';
    readonly listContainerClass: string = 'i-list-container';
    readonly listWraperClass: string = 'i-list-wraper';
    readonly listClass: string = 'i-list';
    readonly listItemClass: string = 'i-list-item';
    $this: JQuery;
    options: Options;
    state: State;


    constructor($this: JQuery, optionsParam: Options) {
      var defaults = {
        containerTmpl: '<div class="i-dropdown-container"></div>',
        inputTmpl: '<input type="text" class="i-input-field"/>',
        arrowTmpl: `<span class="${this.arrowClass}"></span>`,
        listContainerTmpl: '<div class="i-list-container"></div>',
        listWraperTmpl: '<div class="i-list-wraper"></div>',
        listTmpl: '<div class="i-list"></div>',
        listItemTmpl: '<div class="i-list-item"></div>',
        pageCount: 50,
        thresholdPercent: 0.2,
        searchDelay: 300,
        listItemHeight: 30
      };
      var options = $.extend(defaults, optionsParam);

      this.$this = $this;
      this.options = options;
      this.state = {
        isOpen: false,
        isFocus: false,
        isChange:true,
        width: null,
        height: null,
        selectedValue: options.selectedValue,
        inputString:'',
        lastScrollTop: 0,
        indexSection: [0, options.pageCount],
        threshold: Math.ceil(options.pageCount * options.thresholdPercent),
        data: this.buildStateData(options.data, undefined),
        listItemHeight: options.listItemHeight || 30,
        searchDelayTimeoutId: null,
      };

      this.initHtml();
      
      if (this.options.onDataRequestSuccess) {
        this.state.$dom.$arrow
        .removeClass('disabled loading-state-button')
        .find('.loading-state')
        .attr("class", 'caret');
        this.options.onDataRequestSuccess();
      }
    }

    /**
     * 初始化HTML，将原始的元素隐藏，构建插件HTML
     */
    initHtml() {
      var $this = this.$this;

      var $container = $this;
      var $input = $this.find(`.${this.inputClass}`);
      var $arrow = $this.find(`.${this.arrowClass}`);
      var $listContainer = $this.find(`.${this.listContainerClass}`);
      var $listWraper = $this.find(`.${this.listWraperClass}`);
      var $list = $this.find(`.${this.listClass}`);


      this.state.$dom = {
        $container: $container,
        $input: $input,
        $arrow: $arrow,
        $listContainer: $listContainer,
        $listWraper: $listWraper,
        $list: $list,
      }

      $listWraper.css('height', this.state.data.length * this.state.listItemHeight)
      $listContainer.hide();
      if (this.state.selectedValue !== undefined && this.state.selectedValue !== null) {
        this.setCurrentItem(this.state.selectedValue);
      }

      // 绑定事件
      this.state.arrowClickHandler = this.toggleOpen.bind(this);
      this.state.documentClickHandler = this.documentClick.bind(this);
      this.state.listScrollHandler = this.listScroll.bind(this);
      this.state.inputChangeHandler = this.inputChange.bind(this);
      this.state.inputClickHandler = this.searchOpen.bind(this);
      this.state.listItemClickHandler = this.clickListItem.bind(this);

      $list.on('click', '.i-list-item', this.state.listItemClickHandler);
      $arrow.on('click', this.state.arrowClickHandler);
      $(document).on('click', this.state.documentClickHandler);
      $listContainer.on('scroll', this.state.listScrollHandler);
      $input.on('input', this.state.inputChangeHandler)
      $input.on('click', this.state.inputClickHandler)
    }

    toggleOpen(e: JQuery.ClickEvent): void {
      e.stopPropagation();
      var state = this.state;

      if (!state.isOpen) {
        this.state.data = this.buildStateData(this.options.data, undefined);
        this.open();
        if (this.state.isChange) {
          this.resetScrollAndTransform(true);
          this.buildListItems();
        }
      } else {
        this.close();
      }
    }

    searchOpen(e: JQuery.ClickEvent): void {
      e.stopPropagation();
      this.state.data = this.buildStateData(this.options.data, this.state.inputString);
      this.open();
      this.resetScrollAndTransform();
      this.buildListItems();
      
    }

    open() {
      this.state.$dom.$listContainer.show();
      this.state.isOpen = true;
      
    }

    close() {
      this.state.$dom.$listContainer.hide();
      this.state.isOpen = false;
      
    }

    buildListItems() {
      var data = this.state.data.slice(this.state.indexSection[0], this.state.indexSection[1]);
      this.state.$dom.$list.empty();

      for (var i = 0, len = data.length; i < len; i++) {
        const element = data[i];
        var $listItem = $($.parseHTML(this.options.listItemTmpl));
        $listItem.html(element.name).data('id', element.id).data('index', i).css({
          height: this.state.listItemHeight,
        });
        if (element.id === this.state.selectedValue) {
          $listItem.addClass('active');
        }
        this.state.$dom.$list.append($listItem[0]);
      }

    }

    clickListItem(e: JQuery.ClickEvent) {
      e.stopPropagation();
      var $target = $(e.target);
      var id = $target.data('id');
      $target.addClass('active').siblings('.active').removeClass('active');
      this.setCurrentItem(id);
      this.close();
      this.state.isChange = false;
    }

    setCurrentItem(id: string) {
      this.state.selectedValue = id;
      var filterItems = this.state.data.filter(function (x) {
        return x.id === id;
      });
      if (filterItems.length > 0) {
        var currentItem = filterItems[0];
        var index = currentItem.originalIndex;
        this.updateStartEndIndex((index+20)*this.options.listItemHeight)
        this.state.inputString = currentItem.name;
        this.state.$dom.$input.val(currentItem.name).data('id', currentItem.id);
        this.state.$dom.$input.removeClass('invalid');
        if (this.options.onSetSelectValue) {
          this.options.onSetSelectValue(null,{
            id:currentItem.id,
            name:currentItem.name,
            originalItem:currentItem
          },null);
        }
      }

    }

    resetScrollAndTransform(notUpdate?:boolean){
      if (!notUpdate) {
        this.state.indexSection = [0, this.options.pageCount];
        this.state.lastScrollTop = 0;
      }
      this.state.isChange = true;
      this.state.$dom.$listWraper.css('height', this.state.data.length * this.state.listItemHeight);
      this.state.$dom.$listContainer.scrollTop(this.state.lastScrollTop);
      this.state.$dom.$list.css('transform', 'translateY(' + this.state.lastScrollTop + 'px)');
    }

    documentClick(e: JQuery.ClickEvent) {
      var state = this.state;
      if (state.isOpen) {
        state.$dom.$listContainer.hide();
        state.isOpen = false;
      }
    }

    listScroll(e: JQuery.ScrollEvent) {
      var scrollTop = e.target.scrollTop;
      var scrollPX = scrollTop - this.state.lastScrollTop;
      var scrollCount = Math.floor(Math.abs(scrollPX) / this.state.listItemHeight);
 
      
      if (scrollCount >= this.state.threshold) {
        this.updateStartEndIndex(scrollTop);

        this.buildListItems();

        this.state.$dom.$list.css('transform', 'translateY(' + this.state.lastScrollTop + 'px)');
      }
    }

    updateStartEndIndex(scrollTop: number) {
      var data = this.options.data;
      const scrolledRowsCount = Math.floor(scrollTop / this.options.listItemHeight);

      let startIndex = scrolledRowsCount - this.state.threshold - 10;
      let endIndex = scrolledRowsCount + this.options.pageCount + this.state.threshold;

      if (startIndex > data.length - this.options.pageCount) {
        startIndex = data.length - this.options.pageCount
      }

      if (startIndex < 0) {
        startIndex = 0;
      } 

      if (endIndex < this.options.pageCount) {
        endIndex = this.options.pageCount;
      }

      if (endIndex > data.length) {
        endIndex = data.length;
      }

      this.state.indexSection = [startIndex, endIndex];
      this.state.lastScrollTop = startIndex * this.state.listItemHeight;
    }

    /**
     * 构建state中的data，过滤搜索的字符串，并组装index
     * @param data 源数据，一般是option中的data
     * @param key 搜索的字符串
     */
    buildStateData(data: Array<DataItem>, key: string | undefined): Array<DataItem> {
      if (key === undefined || key.trim().length === 0) {
        return data.map(function (item, index) {
          item.index = index;
          item.originalIndex = index;
          return item;
        });
      }

      var searchString = key.trim();
      var filteredData: Array<DataItem> = [];

      for (var i = 0, j = 0, len = data.length; i < len; i++) {
        if (data[i].name.indexOf(searchString) > -1) {
          data[i].index = j;
          data[i].originalIndex = i;
          filteredData.push(data[i]);
          j++;
        }
      }

      return filteredData;
    }

    inputChange(e: JQuery.ChangeEvent) {
      var id = e.target.value;

      if (!this.state.isOpen) {
        this.open();
      }

      if (this.state.searchDelayTimeoutId !== null) {
        clearTimeout(this.state.searchDelayTimeoutId);
      }
      this.state.searchDelayTimeoutId = setTimeout(this.handleInputChange.bind(this), this.options.searchDelay, id);
    }

    handleInputChange(id: string) {
      this.state.inputString = id;
      this.state.data = this.buildStateData(this.options.data, id);
      this.state.selectedValue = null;
      this.state.$dom.$input.data('id', '');
      
      this.resetScrollAndTransform();
      this.buildListItems();
      this.state.$dom.$input.addClass('invalid');
      if (this.options.onUnsetSelectValue) {
        this.options.onUnsetSelectValue();
      }
    }

    destory() {
      $(document).off('click', this.state.documentClickHandler);
      this.state.$dom.$list.off('click', '.i-list-item', this.state.listItemClickHandler);
      this.state.$dom.$arrow.off('click', this.state.arrowClickHandler);
      this.state.$dom.$listContainer.off('scroll', this.state.listScrollHandler);
      this.state.$dom.$input.off('input', this.state.inputChangeHandler)
      this.state.$dom.$input.off('click', this.state.inputClickHandler)
    }
  }



  $.fn.extend({
    dropdown: function (options: Options) {
      return new DropDown(this, options);
    }
  })
})(jQuery);
