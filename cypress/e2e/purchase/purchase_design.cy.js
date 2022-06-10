describe("Login", function() {

  beforeEach(function() {
      cy.fixture('test-data').then(function(testData){
          this.testData = testData});  
  });

  beforeEach(function() {
      cy.visit(this.testData.url);
      cy.wait(15000);
      cy.loginStore(this.testData.email, this.testData.password);
      cy.get('[id="designstore_tab_btn"]').click();
      cy.get('.no-internet-content > div > .btn').click();
      cy.wait(7000);
      cy.frameLoaded('[id="design_store_iframe"]')
  });

  it('Buy design - success', function() {
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="price_asc"]').click();   
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="easter"]').click(); 
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="shield"]').click();       
      cy.iframe('[id="design_store_iframe"]')
        .find('.price-tag').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('.buy-now').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('.view-in-library').should('to.exist');
  });

  it('Buy design - failed', function() {
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="price_desc"]').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="jewellery"]').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="plywood"]').click();
      cy.wait(5000);
      cy.iframe('[id="design_store_iframe"]')
        .find('.store-purchase-btn').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('.buy-now').click();
      cy.get('.alert-error').should('to.exist');
  });

  it('Download design', function(){
      cy.iframe('[id="design_store_iframe"]')
        .find('.btn-go-to-purchases-page').click();
      cy.iframe('[id="design_store_iframe"]')
        .find('[id="paper"]').click();
      cy.wait(2000);
      cy.iframe('[id="design_store_iframe"]')
        .find('.icon-download-alt').click();
      cy.wait(3000);
      cy.iframe('[id="design_store_iframe"]')
        .find('.view-in-library').click();
      cy.get('.file_list_entry').first().should('to.exist');
  })
});
