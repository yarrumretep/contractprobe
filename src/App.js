import React, { Component } from 'react';
import { Button, Card, CardBody, CardSubtitle, CardTitle, Container, Input, InputGroup, InputGroupAddon, Navbar, NavbarBrand } from 'reactstrap';
import ethers from 'ethers';
import pqueue from 'p-queue';

import './App.css';

class App extends Component {
  provider;
  subs = [];
  txqueue = new pqueue({ concurrency: 4 });
  blocks = 0;

  state = {
    address: '0xA62142888ABa8370742bE823c1782D17A0389Da1',
    network: 'mainnet',
    probing: false,
    txs: []
  };

  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.providers.InfuraProvider();
    }
    return this.provider;
  }

  async scanTx(hash) {
    return this.txqueue.add(async () => {
      console.log("tx: " + hash);
      const tx = await this.getProvider().getTransaction(hash);
      if (tx == null) {
        console.log("trying again... " + hash);
        return this.scanTx(hash);
      } else {
        if (tx.to === this.state.address) {
          this.setState({
            txs: [...this.state.txs, tx]
          })
        }
      }
    })
  }

  async scanBlock(blocknum) {
    return this.txqueue.add(async () => {
      console.log('block: ' + blocknum);
      const block = await this.getProvider().getBlock(blocknum);
      if (!block) {
        console.log("skipping: " + blocknum);
      } else {
        this.blocks++;
        if (this.blocks === 1) {
          this.setState({ scanning: true });
        }
        return Promise.all(block.transactions.map(tx => this.scanTx(tx))).then(() => {
          this.blocks--;
          if (this.blocks === 0) {
            this.setState({ scanning: false });
          }
        });
      }
    });
  }

  async scan() {
    const provider = this.getProvider();
    const cb = this.scanBlock.bind(this);
    provider.on('block', cb);
    this.subs.push(() => provider.removeListener('block', cb));

    var current = await provider.getBlockNumber();
    for (var i = 0; i < 20; i++) {
      await this.scanBlock(current - i);
    }
  }

  async listen() {
    const { network, address } = this.state;
    const provider = this.getProvider();
    const url = 'https://api' + (network !== 'mainnet' ? ('-' + network) : '') + '.etherscan.io/api?module=contract&action=getabi&apiKey=JTQN45M6IBIVJUVC5RIZSBGU3IV4STKF2Z&address=' + address;

    console.log("TRYING...");;
    const json = await fetch(url).then(r => r.json());
    console.log(json);
    if (json.status === "1") {
      const abi = JSON.parse(json.result);
      const contract = new ethers.Contract(address, abi, provider);
      console.log("GOT IT", contract);
      for (var event of Object.keys(contract.events)) {
        console.log("EVENT: " + event);
      }
    }
  }

  async ens() {
    const name = await this.getProvider().lookupAddress(this.state.address);
    console.log("Got name: " + name);
    this.setState({
      name
    });
  }

  render() {

    const doProbe = () => {
      this.ens();
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
        <Card style={{ marginTop: '20px' }}>
          <CardTitle>{this.state.address}</CardTitle>
          <CardSubtitle>{this.state.name}</CardSubtitle>
          <CardBody>
            {this.state.scanning ? (<div>Scanning...</div>) : (<div>Done.</div>)}
            {this.state.txs.map(tx => (
              <div key={tx.hash}>
                {tx.hash}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    );

    return (
      <Container className="App">
        <Navbar color="light">
          <NavbarBrand >Ethereum Contract Probe</NavbarBrand>
        </Navbar>

        {this.state.probing ? probe() : input()}

      </Container>
    );
  }
}

export default App;
