const express = require('express');
const fs = require('fs');
const saml = require('samlify');
const axios = require('axios');
const bodyParser = require("body-parser");
const app = express();
const path = require('path'); 
const serveStatic = require('serve-static');

const port=8080;
  
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(serveStatic(path.resolve(__dirname, 'public')));

//import * as validator from '@authenio/samlify-xsd-schema-validator';
// import * as validator from '@authenio/samlify-validate-with-xmllint';
// import * as validator from '@authenio/samlify-node-xmllint';
// import * as validator from '@authenio/samlify-libxml-xsd'; // only support for version of nodejs <= 8

// const validator = require('@authenio/samlify-xsd-schema-validator');
// const validator = require('@authenio/samlify-validate-with-xmllint');
// const validator = require('@authenio/samlify-node-xmllint');
// const validator = require('@authenio/samlify-libxml-xsd');

//saml.setSchemaValidator(validator);

saml.setSchemaValidator({
  validate: (response) => {
    /* implment your own or always returns a resolved promise to skip */
    return Promise.resolve('skipped');
  }
});

// URL to the okta metadata
 const uri_okta_metadata = 'https://imnasol.okta.com/app/exk6qtmek9kDvXvtM4h6/sso/saml/metadata';//'https://dev-xxxxxxx.oktapreview.com/app/APP_ID/sso/saml/metadata';

axios.get(uri_okta_metadata)
.then(response => {

  const idp = saml.IdentityProvider({
    metadata: response.data,
    isAssertionEncrypted: true,
    messageSigningOrder: 'encrypt-then-sign',
    wantLogoutRequestSigned: true
  });

  const sp = saml.ServiceProvider({
    entityID: 'http://localhost:8080/sp/metadata?encrypted=true',
    authnRequestsSigned: false,
    wantAssertionsSigned: true,
    wantMessageSigned: true,
    wantLogoutResponseSigned: true,
    wantLogoutRequestSigned: true,
    // the private key (.pem) use to sign the assertion; 
    privateKey: fs.readFileSync(__dirname + '/ssl/sign/key.pem'),       
    // the private key pass;
    privateKeyPass: 'VHOSp5RUiBcrsjrcAuXFwU1NKCkGA8px',                     
    // the private key (.pem) use to encrypt the assertion;
    encPrivateKey: fs.readFileSync(__dirname + '/ssl/encrypt/key.pem'),             
    isAssertionEncrypted: true,
    assertionConsumerService: [{
      Binding: saml.Constants.namespace.post,
      Location: 'http://localhost:8080/sp/acs?encrypted=true',
    }]
  });

  app.post('/sp/assert', async (req, res) => {
    try {
      const { extract } = await sp.parseLoginResponse(idp, 'post', req);
      console.log(extract.attributes);
      /**
      *
      * Implement your logic here. 
      * extract.attributes, should contains : firstName, lastName, email, uid, groups 
      *           
      **/
     res.redirect("http://rambam.imnasol.com/login/okta");
    } catch (e) {
      console.error('[FATAL] when parsing login response sent from okta', e);
      return res.redirect('/');
    }
  });

  app.get('/login', async (req, res) => {
        const { id, context } = await sp.createLoginRequest(idp, 'redirect');
        console.log(context);
        return res.redirect(context);
      });

  app.get('/sp/metadata', (req, res) => {
    console.log("here");
    res.header('Content-Type', 'text/xml').send(idp.getMetadata());
  });

  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })
});