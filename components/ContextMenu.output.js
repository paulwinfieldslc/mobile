'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

(function () {
  /**
   * ContextMenu component
   * @container
   */
  var contextMenu = function (_HTMLElement) {
    _inherits(contextMenu, _HTMLElement);

    function contextMenu(self) {
      var _this, _ret;

      _classCallCheck(this, contextMenu);

      self = (_this = _possibleConstructorReturn(this, (contextMenu.__proto__ || Object.getPrototypeOf(contextMenu)).call(this, self)), _this);
      return _ret = self, _possibleConstructorReturn(_this, _ret);
    }

    _createClass(contextMenu, [{
      key: 'connectedCallback',
      value: function connectedCallback() {
        this._render();
      }
    }, {
      key: 'disconnectedCallback',
      value: function disconnectedCallback() {}
    }, {
      key: 'attributeChangedCallback',
      value: function attributeChangedCallback(attrName, oldVal, newVal) {}
    }, {
      key: 'open',
      value: function open() {
        var container = document.getElementsByClassName('menu-container')[0];
        container.classList.remove('menu-closed');
        container.classList.add('menu-opened');
        this.opened = true;
        container.addEventListener('click', this.closeMenuHandler, true);
      }
    }, {
      key: 'openMenuHandler',
      value: function openMenuHandler(e) {
        var contextMenu = document.getElementsByTagName('context-menu')[0];
        contextMenu.open();
      }
    }, {
      key: 'close',
      value: function close() {
        var container = document.getElementsByClassName('menu-container')[0];
        container.classList.remove('menu-opened');
        container.classList.add('menu-closed');
        this.opened = false;
        container.removeEventListener('click', this.closeMenuHandler, true);
      }
    }, {
      key: 'closeMenuHandler',
      value: function closeMenuHandler(e) {
        var contextMenu = document.getElementsByTagName('context-menu')[0];
        contextMenu.close();
      }
    }, {
      key: '_render',
      value: function _render() {
        var container = document.createElement('div');
        container.className = 'menu-container menu-closed ';

        // Host container for the menu items
        var menu = document.createElement('div');
        menu.className = 'menu-content-area';
        while (this.childNodes.length !== 0) {
          menu.appendChild(this.childNodes[0]);
        }

        // Opener for the menu
        var opener = document.createElement('div');
        opener.innerHTML = '<i class="fa fa-2x fa-bars"></i>';
        opener.className = "menu-opener";
        opener.addEventListener('click', this.openMenuHandler, true);

        container.appendChild(opener);

        window.addEventListener('resize', this.windowSizeChange);

        // Add the menu stuff to the container
        container.appendChild(menu);
        this.appendChild(container);
        this.opened = false;
      }
    }, {
      key: 'windowSizeChange',
      value: function windowSizeChange() {}
    }], [{
      key: 'observedAttributes',
      get: function get() {
        return undefined;
      }
    }]);

    return contextMenu;
  }(HTMLElement);

  customElements.define('context-menu', contextMenu);
})();