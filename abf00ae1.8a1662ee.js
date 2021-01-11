(window.webpackJsonp=window.webpackJsonp||[]).push([[20],{103:function(e,t,r){"use strict";r.d(t,"a",(function(){return l})),r.d(t,"b",(function(){return f}));var n=r(0),a=r.n(n);function i(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function c(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){i(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var p=a.a.createContext({}),d=function(e){var t=a.a.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):c(c({},t),e)),r},l=function(e){var t=d(e.components);return a.a.createElement(p.Provider,{value:t},e.children)},u={inlineCode:"code",wrapper:function(e){var t=e.children;return a.a.createElement(a.a.Fragment,{},t)}},b=a.a.forwardRef((function(e,t){var r=e.components,n=e.mdxType,i=e.originalType,o=e.parentName,p=s(e,["components","mdxType","originalType","parentName"]),l=d(r),b=n,f=l["".concat(o,".").concat(b)]||l[b]||u[b]||i;return r?a.a.createElement(f,c(c({ref:t},p),{},{components:r})):a.a.createElement(f,c({ref:t},p))}));function f(e,t){var r=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var i=r.length,o=new Array(i);o[0]=b;var c={};for(var s in t)hasOwnProperty.call(t,s)&&(c[s]=t[s]);c.originalType=e,c.mdxType="string"==typeof e?e:n,o[1]=c;for(var p=2;p<i;p++)o[p]=r[p];return a.a.createElement.apply(null,o)}return a.a.createElement.apply(null,r)}b.displayName="MDXCreateElement"},107:function(e,t,r){"use strict";var n=r(4),a=r(0),i=r.n(a),o=function(e){function t(){return e.apply(this,arguments)||this}Object(n.a)(t,e);var r=t.prototype;return r.renderMethod=function(){return"post"===this.props.method?i.a.createElement("span",{className:"method post"},"POST"):"get"===this.props.method?i.a.createElement("span",{className:"method get"},"GET"):"object"===this.props.method?i.a.createElement("span",{className:"method object"},"OBJECT"):null},r.renderAuth=function(){if(this.props.requiresAuth)return i.a.createElement("span",{className:"remark auth"},"[requires authentication]")},r.render=function(){return i.a.createElement("div",{className:"apiheader"},this.renderMethod(),i.a.createElement("span",{className:"url"},this.props.children),i.a.createElement("div",{style:{flexGrow:1}}),this.renderAuth())},t}(i.a.Component);t.a=o},88:function(e,t,r){"use strict";r.r(t),r.d(t,"frontMatter",(function(){return c})),r.d(t,"metadata",(function(){return s})),r.d(t,"toc",(function(){return p})),r.d(t,"default",(function(){return l}));var n=r(3),a=r(7),i=(r(0),r(103)),o=r(107),c={title:"Get Friends"},s={unversionedId:"apidocs/friends/friends",id:"apidocs/friends/friends",isDocsHomePage:!1,title:"Get Friends",description:"/friends",source:"@site/docs/apidocs/friends/friends.md",slug:"/apidocs/friends/friends",permalink:"/docs/apidocs/friends/friends",editUrl:"https://github.com/facebook/docusaurus/edit/master/website/docs/apidocs/friends/friends.md",version:"current",sidebar:"developersSidebar",previous:{title:"The Friends Object",permalink:"/docs/apidocs/friends/friendsObject"},next:{title:"Send Friend Request",permalink:"/docs/apidocs/friends/requestByUsername"}},p=[{value:"Description",id:"description",children:[]},{value:"Response 200",id:"response-200",children:[]}],d={toc:p};function l(e){var t=e.components,r=Object(a.a)(e,["components"]);return Object(i.b)("wrapper",Object(n.a)({},d,r,{components:t,mdxType:"MDXLayout"}),Object(i.b)(o.a,{method:"get",requiresAuth:!0,mdxType:"ApiHeader"},"/friends"),Object(i.b)("h3",{id:"description"},"Description"),Object(i.b)("p",null,"Gets the list of friends for this user"),Object(i.b)("h3",{id:"response-200"},"Response 200"),Object(i.b)("table",null,Object(i.b)("thead",{parentName:"table"},Object(i.b)("tr",{parentName:"thead"},Object(i.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Field"),Object(i.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Type"),Object(i.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Description"))),Object(i.b)("tbody",{parentName:"table"},Object(i.b)("tr",{parentName:"tbody"},Object(i.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"friends"),Object(i.b)("td",Object(n.a)({parentName:"tr"},{align:null}),Object(i.b)("a",Object(n.a)({parentName:"td"},{href:"friendsObject"}),"Friends[]")),Object(i.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"List of friends of this user")))))}l.isMDXComponent=!0}}]);