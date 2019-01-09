import React from 'react';
import translate from '../translate/translate';

class ServerSelect extends React.Component {
  constructor() {
    super();
    this.state = {
      electrumServer: '',
      serverList: [],
      selectedOption: '',
      errorTestingServer: false,
      connecting: false,
    };
    this.updateInput = this.updateInput.bind(this);
    this.setElectrumServer = this.setElectrumServer.bind(this);
  }

  componentWillMount() {
    this.props.getServersList()
    .then((res) => {
      const _coin = this.props.coin;

      this.setState({
        selectedOption: res[_coin].ip + ':' + res[_coin].port + ':' + res[_coin].proto,
        electrumServer: res[_coin].ip + ':' + res[_coin].port + ':' + res[_coin].proto,
        serverList: res[_coin].serverList,
      });
    });
  }

  updateInput(e) {
    this.setState({
      [e.target.name]: e.target.value,
      errorTestingServer: false,
      connecting: false,
    });
  }

  setElectrumServer() {
    const _server = this.state.selectedOption.split(':');

    this.props.setDefaultServer(
      this.props.coin,
      _server[1],
      _server[0]
    )
    .then((res) => {
      if (res === 'error') {
        this.setState({
          errorTestingServer: true,
          connecting: false,
        });
      } else {
        this.setState({
          errorTestingServer: false,
          connecting: true,
        });
        this.props.dashboardRefresh();
      }
    });
  }

  renderServerListSelectorOptions() {
    let _items = [];
    let _spvServers = this.state.serverList;

    for (let i = 0; i < _spvServers.length; i++) {
      _items.push(
        <option
          key={ `spv-server-list-${i}` }
          value={ `${_spvServers[i]}` }>{ `${_spvServers[i]}` }</option>
      );
    }

    return _items;
  }

  render() {
    return (
      <div className="margin-top-40 form server-select">
        <div className="bold text-center">
          <span className="error-server">{ translate('DASHBOARD.CON_ERROR', this.props.coin.toUpperCase()) }</span>
        </div>
        <div className="server-select-inner">
          <div className="server-form-control">
            <select
              name="selectedOption"
              value={ this.state.selectedOption }
              onChange={ (event) => this.updateInput(event) }
              autoFocus>
              { this.renderServerListSelectorOptions() }
            </select>
          </div>
          { this.state.errorTestingServer &&
            <div className="error margin-top-10 margin-bottom-10 text-center">
            { translate('DASHBOARD.ERROR_TESTING_SERVER', this.state.selectedOption) }
            </div>
          }
          { this.state.connecting &&
            <div className="margin-top-20 margin-bottom-10 text-center">
            { translate('DASHBOARD.CONNECTING_TO_NEW_SERVER') }
            </div>
          }
          <button type="button" className="icon-btn" onClick={this.setElectrumServer}>
              <img className="icon-btn-image" src="/images/template/transactions/sync_icon.svg"/>
                {translate('DASHBOARD.SWITCH_SERVER')}
          </button>
        </div>
      </div>
    );
  }
}

export default ServerSelect;