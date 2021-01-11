(window.webpackJsonp=window.webpackJsonp||[]).push([[27],{103:function(e,t,r){"use strict";r.d(t,"a",(function(){return l})),r.d(t,"b",(function(){return m}));var n=r(0),a=r.n(n);function c(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function o(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){c(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},c=Object.keys(e);for(n=0;n<c.length;n++)r=c[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var c=Object.getOwnPropertySymbols(e);for(n=0;n<c.length;n++)r=c[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var u=a.a.createContext({}),p=function(e){var t=a.a.useContext(u),r=t;return e&&(r="function"==typeof e?e(t):o(o({},t),e)),r},l=function(e){var t=p(e.components);return a.a.createElement(u.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.a.createElement(a.a.Fragment,{},t)}},b=a.a.forwardRef((function(e,t){var r=e.components,n=e.mdxType,c=e.originalType,i=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),l=p(r),b=n,m=l["".concat(i,".").concat(b)]||l[b]||d[b]||c;return r?a.a.createElement(m,o(o({ref:t},u),{},{components:r})):a.a.createElement(m,o({ref:t},u))}));function m(e,t){var r=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var c=r.length,i=new Array(c);i[0]=b;var o={};for(var s in t)hasOwnProperty.call(t,s)&&(o[s]=t[s]);o.originalType=e,o.mdxType="string"==typeof e?e:n,i[1]=o;for(var u=2;u<c;u++)i[u]=r[u];return a.a.createElement.apply(null,i)}return a.a.createElement.apply(null,r)}b.displayName="MDXCreateElement"},107:function(e,t,r){"use strict";var n=r(4),a=r(0),c=r.n(a),i=function(e){function t(){return e.apply(this,arguments)||this}Object(n.a)(t,e);var r=t.prototype;return r.renderMethod=function(){return"post"===this.props.method?c.a.createElement("span",{className:"method post"},"POST"):"get"===this.props.method?c.a.createElement("span",{className:"method get"},"GET"):"object"===this.props.method?c.a.createElement("span",{className:"method object"},"OBJECT"):null},r.renderAuth=function(){if(this.props.requiresAuth)return c.a.createElement("span",{className:"remark auth"},"[requires authentication]")},r.render=function(){return c.a.createElement("div",{className:"apiheader"},this.renderMethod(),c.a.createElement("span",{className:"url"},this.props.children),c.a.createElement("div",{style:{flexGrow:1}}),this.renderAuth())},t}(c.a.Component);t.a=i},95:function(e,t,r){"use strict";r.r(t),r.d(t,"frontMatter",(function(){return o})),r.d(t,"metadata",(function(){return s})),r.d(t,"toc",(function(){return u})),r.d(t,"default",(function(){return l}));var n=r(3),a=r(7),c=(r(0),r(103)),i=r(107),o={title:"Send Friend Request"},s={unversionedId:"apidocs/friends/requestByUsername",id:"apidocs/friends/requestByUsername",isDocsHomePage:!1,title:"Send Friend Request",description:"/friends/requestByUsername",source:"@site/docs/apidocs/friends/requestByUsername.md",slug:"/apidocs/friends/requestByUsername",permalink:"/docs/apidocs/friends/requestByUsername",editUrl:"https://github.com/facebook/docusaurus/edit/master/website/docs/apidocs/friends/requestByUsername.md",version:"current",sidebar:"developersSidebar",previous:{title:"Get Friends",permalink:"/docs/apidocs/friends/friends"},next:{title:"Accept Friend Request",permalink:"/docs/apidocs/friends/acceptByUsername"}},u=[{value:"Description",id:"description",children:[]},{value:"Parameters",id:"parameters",children:[]},{value:"Errors",id:"errors",children:[]}],p={toc:u};function l(e){var t=e.components,r=Object(a.a)(e,["components"]);return Object(c.b)("wrapper",Object(n.a)({},p,r,{components:t,mdxType:"MDXLayout"}),Object(c.b)(i.a,{method:"post",requiresAuth:!0,mdxType:"ApiHeader"},"/friends/requestByUsername"),Object(c.b)("h3",{id:"description"},"Description"),Object(c.b)("p",null,"Send a friend request to another uesr by username"),Object(c.b)("h3",{id:"parameters"},"Parameters"),Object(c.b)("table",null,Object(c.b)("thead",{parentName:"table"},Object(c.b)("tr",{parentName:"thead"},Object(c.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Field"),Object(c.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Type"),Object(c.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Description"))),Object(c.b)("tbody",{parentName:"table"},Object(c.b)("tr",{parentName:"tbody"},Object(c.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"username"),Object(c.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"String"),Object(c.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"Username of the user to request friends with")))),Object(c.b)("h3",{id:"errors"},"Errors"),Object(c.b)("table",null,Object(c.b)("thead",{parentName:"table"},Object(c.b)("tr",{parentName:"thead"},Object(c.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Reason"),Object(c.b)("th",Object(n.a)({parentName:"tr"},{align:null}),"Description"))),Object(c.b)("tbody",{parentName:"table"},Object(c.b)("tr",{parentName:"tbody"},Object(c.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"user.unkownTarget"),Object(c.b)("td",Object(n.a)({parentName:"tr"},{align:null}),"The user does not exist")))))}l.isMDXComponent=!0}}]);