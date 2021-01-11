import React from 'react';

class ApiHeader extends React.Component {
    renderMethod() {
        if (this.props.method === "post") {
            return <span className="method post">POST</span>
        } else if (this.props.method === "get") {
            return <span className="method get">GET</span>
        } else if (this.props.method === "object") {
            return <span className="method object">OBJECT</span>
        } else {
            return null;
        }
    }

    renderAuth() {
        if (this.props.requiresAuth) {
            return <span className="remark auth">[requires authentication]</span>
        }
    }

    render() {
        return <div className="apiheader">
            {this.renderMethod()}
            <span className="url">{this.props.children}</span>
            <div style={{flexGrow: 1}}></div>
            {this.renderAuth()}
        </div>
    }
}

export default ApiHeader;