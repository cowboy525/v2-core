# Local deployment

cp `.env.example` to `.env` and fill the next enviroment variables

Run deployment:

Terminal 1

```shell
npx hardhat node --no-deploy
```

Terminal 2

```shell
yarn deploy localhost --reset
cp /deployments/localhost/deployData.json <frontend dir>/src/ui-config/addresses/local.json
```

# Tests

(after .env copied)

```shell
yarn test
```
