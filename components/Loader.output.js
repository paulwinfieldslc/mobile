'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

(function () {

  /**
   * ctLoader component
   * @attribute {string} [message] - A message to display whilst the spinner is showing
   */
  var Loader = function (_HTMLElement) {
    _inherits(Loader, _HTMLElement);

    function Loader(self) {
      var _this, _ret;

      _classCallCheck(this, Loader);

      self = (_this = _possibleConstructorReturn(this, (Loader.__proto__ || Object.getPrototypeOf(Loader)).call(this, self)), _this);
      return _ret = self, _possibleConstructorReturn(_this, _ret);
    }

    _createClass(Loader, [{
      key: 'connectedCallback',
      value: function connectedCallback() {
        this._render();
      }
    }, {
      key: 'disconnectedCallback',
      value: function disconnectedCallback() {}
    }, {
      key: 'show',
      value: function show() {
        this.className = 'active';
      }
    }, {
      key: 'close',
      value: function close() {
        this.className = '';
      }
    }, {
      key: 'attributeChangedCallback',
      value: function attributeChangedCallback(attrName, oldVal, newVal) {
        var displayMessage = this.getAttribute("message") || "Loading - please wait a moment";
        var elem = this.getElementsByClassName("loading-message");
        if (elem && elem.length > 0) {
          elem[0].innerHTML = displayMessage;
        }
      }
    }, {
      key: '_render',
      value: function _render() {
        var displayMessage = this.getAttribute("message") || "Loading - please wait a moment";
        // In the sample app, refer to the component-css styles for any styles used in this component
        this.innerHTML = '<div class="header"></div><div class="spinner"></div><div class="loading-message">' + displayMessage + '</div>';
        this.className = '';
      }
    }], [{
      key: 'observedAttributes',
      get: function get() {
        return ["message"];
      }
    }]);

    return Loader;
  }(HTMLElement);

  customElements.define('ct-loader', Loader);
})();