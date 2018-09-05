import React, { Component } from 'react';
import { Button, Card, CardBody, CardTitle, Collapse, DropdownToggle, DropdownMenu, DropdownItem, Input, InputGroup, InputGroupAddon, Navbar, NavbarBrand, Table, UncontrolledDropdown, } from 'reactstrap';
import Web3 from 'web3';
import { pickBy, keys, get } from 'lodash';

import './App.css';

class App extends Component {
  web3;
  subs = [];
  blocks = 0;

  state = {
    address: '0xA62142888ABa8370742bE823c1782D17A0389Da1',
    network: 'mainnet',
    probing: false,
    events: {},
    open: {},
    mappings: {}
  };

  getWeb3() {
    if (!this.web3) {
      this.web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));
    }
    return this.web3;
  }

  async listen() {
    const { network, address } = this.state;
    const web3 = this.getWeb3();
    const url = 'https://api' + (network !== 'mainnet' ? ('-' + network) : '') + '.etherscan.io/api?module=contract&action=getabi&apiKey=JTQN45M6IBIVJUVC5RIZSBGU3IV4STKF2Z&address=' + address;

    const block = await web3.eth.getBlockNumber();

    console.log("TRYING...");;
    const json = await fetch(url).then(r => r.json());
    console.log(json);
    if (json.status === "1") {
      const abi = JSON.parse(json.result);
      const contract = new web3.eth.Contract(abi, address);
      console.log("GOT IT", contract);
      contract.events.allEvents({
        fromBlock: block - 4 * 60 * 15
      }, (err, event) => {
        var mapped = {
          ___event: event.event,
          ___block: event.blockNumber,
          ___id: event.id,
          ...pickBy(event.returnValues, (v, k) => isNaN(+k))
        };
        this.setState({
          events: {
            ...this.state.events,
            [event.event]: [mapped, ...(this.state.events[event.event] || [])]
          }
        });
      })
    }
  }

  async ens() {
    /*const name = await this.getWeb3().lookupAddress(this.state.address);
    console.log("Got name: " + name);
    this.setState({
      name
    });*/
  }

  toggle(event) {
    this.setState({
      open: {
        ...this.state.open,
        [event]: !this.state.open[event]
      }
    });
  }

  componentDidMount() {
    const mappings = JSON.parse(localStorage.getItem('mappings') || "{}");
    console.log("MAPPINGS:", mappings);
    this.setState({
      mappings
    });
  }

  render() {

    const doProbe = () => {
      //      this.ens();
      this.listen();
      this.setState({
        probing: true
      });
    };

    const reset = () => {
      this.setState({
        //address: undefined,
        probing: false
      });
    };

    const validateAddress = () => {
      return this.state.address && this.state.address.length === 42 && this.state.address.startsWith('0x');
    };

    const setAddress = (event) => {
      this.setState({
        address: event.target.value.trim()
      })
    };

    const defaultFormat = (value) => {
      if (typeof value === 'string' && value.startsWith('0x')) {
        return value.slice(0, 8) + "..." + value.slice(-8);
      } else {
        return value.toString();
      }
    };

    const formatEther = (value) => this.getWeb3().utils.fromWei(value, 'ether');

    const formatString = (value) => this.getWeb3().utils.hexToString(value);

    const formatTimestamp = (value) => new Date(value * 1000).toString();

    const formatAddress = (value) => (<a target="etherscan" href={"https://etherscan.io/address/" + value}>{value.slice(0, 8) + "..." + value.slice(-8)}</a>)

    const formats = {
      default: defaultFormat,
      ether: formatEther,
      string: formatString,
      timestamp: formatTimestamp,
      address: formatAddress,
      skip: undefined
    };

    const setFormat = (event, key, format) => {
      const mappings = {
        ...this.state.mappings,
        [this.state.address]: {
          ...this.state.mappings[this.state.address],
          [event]: {
            ...get(this.state.mappings, [this.state.address, event], {}),
            [key]: { key, format }
          }
        }
      };
      localStorage.setItem('mappings', JSON.stringify(mappings));
      this.setState({
        mappings
      });
    }

    const eventTable = (key) => {
      const events = this.state.events[key];
      const columns = keys(events[0]).filter(k => !k.startsWith('___')).map(k => get(this.state.mappings, [this.state.address, key, k], { key: k, format: 'default' })).filter(c => !!formats[c.format]);

      return (
        <Table>
          <thead>
            <tr>
              {columns.map(c => (
                <td key={c.key}>
                  <UncontrolledDropdown size="sm">
                    <DropdownToggle caret>
                      {c.key}
                    </DropdownToggle>
                    <DropdownMenu>
                      {keys(formats).map(fmt => (
                        <DropdownItem key={fmt} onClick={() => setFormat(key, c.key, fmt)}>
                          {fmt}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </UncontrolledDropdown>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.___id}>
                {columns.map(c => (<td key={event.__id + ":" + c.key}>{formats[c.format](event[c.key])}</td>))}
              </tr>
            ))}
          </tbody>
        </Table>
      );
    };

    const input = () => (
      <div>
        <InputGroup>
          <InputGroupAddon addonType="prepend">Contract address</InputGroupAddon>
          <Input placeholder="0x" value={this.state.address} onChange={setAddress} />
        </InputGroup>
        <Button color="primary" onClick={doProbe} disabled={!validateAddress()}>Probe...</Button>
      </div>
    );

    const probe = () => (
      <div>
        <Button color="warning" onClick={reset}>Reset</Button>
        {keys(this.state.events).map(key => (
          <Card key={key} style={{ marginTop: '10px' }}>
            <CardTitle style={{ padding: '5px', textAlign: 'left' }}><div onClick={() => this.toggle(key)}>{key.substring(2)} - {this.state.events[key].length}</div></CardTitle>
            <Collapse isOpen={this.state.open[key]}>
              <CardBody> {eventTable(key)} </CardBody>
            </Collapse>
          </Card>
        ))}
      </div>
    );


    return (
      <div style={{ padding: '20px' }}>
        <Navbar color="light">
          <NavbarBrand >Ethereum Contract Probe</NavbarBrand>
        </Navbar>

        {this.state.probing ? probe() : input()}
      </div>
    );
  }
}

export default App;
