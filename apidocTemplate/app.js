class App extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            apiData: null,
            currentCall: null
        };
    }
    
    async componentDidMount() {
        let projectData = await (await fetch("api_project.json")).json();
        let currentCall = null;
        
        if (projectData.header) currentCall = "header";
        
        this.setState({
            apiData: await (await fetch("api_data.json")).json(),
            projectData: projectData,
            currentCall: currentCall
        });
    }
    
    renderCalls() {
        let els = [];
        
        //Sort the calls into groups
        let groups = {};
        for (let call of this.state.apiData) {
            if (!groups[call.groupTitle]) groups[call.groupTitle] = [];
            groups[call.groupTitle].push(call);
        }
        
        for (let group in groups) {
            els.push(<Header title={group} />)
            for (let call of groups[group]) {
                els.push(<Call data={call} pjData={this.state.projectData} />);
            }
        }
        return els;
    }
    
    setCurrentCall(call) {
        this.setState({
            currentCall: call
        });
    }
    
    renderCurrentCall() {
        let call = this.state.currentCall;
        if (call) {
            if (call === "header") {
                return <div>
                    <Header title={this.state.projectData.header.title} />
                    <div className="headerContents" dangerouslySetInnerHTML={{__html: this.state.projectData.header.content}} />
                </div>
            } else {
                return <Call data={call} pjData={this.state.projectData} />;
            }
        } else {
            return null;
        }
    }
    
    render() {
        if (this.state.apiData === null) {
            return <div>Loading...</div>;
        } else {
            return <div className="mainContainer">
                <Sidebar currentCall={this.state.currentCall}
                         data={this.state.apiData}
                         pjData={this.state.projectData}
                         setCurrentCall={this.setCurrentCall.bind(this)} />
                <div className="bigContainer">
                    {this.renderCurrentCall()}
                </div>
            </div>;
        }
    }
}

const domContainer = document.querySelector('#appContainer');
ReactDOM.render(React.createElement(App), domContainer);