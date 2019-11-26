class Call extends React.Component {
    renderTypeSquare() {
        let col;
        switch (this.props.data.type) {
            case "get":
                col = "rgb(0, 100, 255)";
                break;
            case "post":
                col = "rgb(0, 100, 0)";
        }
        return <span className="typeSquare" style={{"background-color": col}}>
            {this.props.data.type.toUpperCase()}
        </span>
    }
    
    renderFieldTable(fields) {
        let tables = [];
        for (let f in fields) {
            let rows = [];
            
            rows.push(<tr><th>Field</th><th>Type</th><th>Description</th></tr>);
            
            for (let param of fields[f]) {
                rows.push(<tr>
                    <td width="300px">{param.field}</td>
                    <td width="300px">{param.type}</td>
                    <td dangerouslySetInnerHTML={{__html: param.description}} />
                </tr>)
            }
            
            tables.push(<div>
                <h2>{f}</h2>
                <table><tbody>
                    {rows}
                </tbody></table>
            </div>);
        }
        return tables;
    }
    
    renderFields() {
        let fields = [];
        if (this.props.data.parameter) {
            fields.push(this.renderFieldTable(this.props.data.parameter.fields));
        }
        if (this.props.data.success) {
            fields.push(this.renderFieldTable(this.props.data.success.fields));
        }
        if (this.props.data.error) {
            fields.push(this.renderFieldTable(this.props.data.error.fields));
        }
        
        return fields;
    }
    
    renderDescription() {
        if (this.props.data.description) {
            return <div className="callDescription" dangerouslySetInnerHTML={{__html: this.props.data.description}} />
        } else {
            return null;
        }
    }
    
    renderCallUrl() {
        if (this.props.data.url === ".") return null;
        return <div className="callUrl">
            <span>{this.renderTypeSquare()}<code>{this.props.pjData.url + this.props.data.url}</code></span>
        </div>
    }
    
    render() {
        return <div className="call">
            <Header title={this.props.data.title} />
            {this.renderCallUrl()}
            {this.renderDescription()}
            {this.renderFields()}
        </div>
    }
}