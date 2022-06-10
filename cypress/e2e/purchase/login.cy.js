describe("Login", function() {

  beforeEach(function() {
      cy.fixture('test-data').then(function(testData){
          this.testData = testData});  
  });

  beforeEach(function() {
      cy.visit(this.testData.url);
      cy.wait(15000);
      cy.get('[id="login_screen_email_address_in"]').type(this.testData.email);
      cy.get('[id="login_screen_password_in"]').type(this.testData.password);
      cy.get('[id="login_screen_login_btn"]').click();
      cy.get('[id="designstore_tab_btn"]').click();
      cy.get('.no-internet-content > div > .btn').click();
      cy.wait(7000);
      cy.get('[id="workingarea"]').should('to.exist'); 
  });

  it('Login', function() {
      cy.iframe('[id="design_store_iframe"]')
        .contains('Enter your existing code').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('[placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"]').first().type(this.testData.verify_code);
      cy.iframe('[id="design_store_iframe"]')
        .contains('Verify').click();
  });
});