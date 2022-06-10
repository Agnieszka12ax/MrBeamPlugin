require('cypress-iframe');
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
Cypress.Commands.add("loginStore", (email, password) => {
  
    cy.get('[id="login_screen_email_address_in"]').type(email);
    cy.get('[id="login_screen_password_in"]').type(password);
    cy.get('[id="login_screen_login_btn"]').click();
    cy.get('[id="designstore_tab_btn"]').click();
    cy.get('[id="workingarea"]').should('to.exist');  
  });

Cypress.Commands.add('getIframeBody', () => {
    cy.log('getIframeBody')
      return cy
    .get('iframe[id="design_store_iframe"]', { log: false })
    .its('0.contentDocument.body', { log: false }).should('not.be.empty')
    .then((body) => cy.wrap(body, { log: false }));
  });
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })