describe("Access control", function () {
    beforeEach(function () {
        cy.fixture("test-data").then(function (testData) {
            this.testData = testData;
        });
    });
    beforeEach(function () {
        cy.visit(this.testData.url_laser);
        cy.get('[id="loading_overlay"]', { timeout: 20000 }).should(
            "not.be.visible"
        );
        cy.loginLaser(this.testData.email, this.testData.password);
        cy.get('[data-test="mrbeam-ui-index-menu-burger"]').click();
        cy.get('[data-test="mrbeam-ui-index-tab-settings"]').click({
            force: true,
        });
    });

    it("Access control - new user", function () {
        cy.get('[id="settings_users_link"]').click();
        cy.get('[title="Add user"]').click();
        cy.get("#settings-usersDialogAddUserName").clear("de");
        cy.get("#settings-usersDialogAddUserName").type("dev+1@mr-beam.org");
        cy.get("#settings-usersDialogAddUserPassword1").clear("a");
        cy.get("#settings-usersDialogAddUserPassword1").type("a");
        cy.get("#settings-usersDialogAddUserPassword2").clear("a");
        cy.get("#settings-usersDialogAddUserPassword2").type("a");
        cy.get("#settings-usersDialogAddUserActive").check();
        cy.get("#settings-usersDialogAddUserAdmin").check();
        cy.get(
            "#settings-usersDialogAddUser > .modal-footer > .btn-primary"
        ).click();
        cy.get(".settings_users_name")
            .contains("dev+1@mr-beam.org")
            .should("to.exist");
        cy.logout();
        cy.get('[id="login_screen_email_address_in"]')
            .clear()
            .type("dev+1@mr-beam.org");
        cy.get('[id="login_screen_password_in"]').clear().type("a");
        cy.get('[id="login_screen_login_btn"]').click();
        cy.wait(1000);
        cy.laserSafety();
        cy.get('[id="navbar_login"]')
            .invoke("prop", "innerText")
            .should("to.contain", "dev+1@mr-beam.org");
    });

    it("Access control - new password", function () {
        cy.get('[id="settings_users_link"]').click();
        cy.get(":nth-child(1) > .settings_users_actions > .fa-key").click();
        cy.get("#settings-usersDialogChangePasswordPassword1")
            .clear()
            .type("aa");
        cy.get("#settings-usersDialogChangePasswordPassword2")
            .clear()
            .type("aa");
        cy.get(
            "#settings-usersDialogChangePassword > .modal-footer > .btn-primary"
        ).click();
        cy.logout();
        cy.get('[id="login_screen_email_address_in"]')
            .clear()
            .type("dev+1@mr-beam.org");
        cy.get('[id="login_screen_password_in"]').clear().type("aa");
        cy.get('[id="login_screen_login_btn"]').click();
        cy.get("#navbar_login > .dropdown-toggle").click();
        cy.get("#usersettings_button").click();
        cy.get("#userSettings-access_password").clear().type("a");
        cy.get("#userSettings-access_repeatedPassword").clear().type("a");
        cy.get("#usersettings_dialog > .modal-footer > .btn-primary").click();
        cy.logout();
        cy.get('[id="login_screen_email_address_in"]')
            .clear()
            .type("dev+1@mr-beam.org");
        cy.get('[id="login_screen_password_in"]').clear().type("a");
        cy.get('[id="login_screen_login_btn"]').click();
    });

    it("Access control - delete user", function () {
        cy.get('[id="settings_users_link"]').click();
        cy.get(":nth-child(1) > .settings_users_actions > .fa-trash-o").click();
        cy.get(".settings_users_name")
            .contains("dev+1@mr-beam.org")
            .should("not.exist");
    });

    it("Access control - abort button", function () {
        cy.get('[id="settings_users_link"]').click();
        cy.get(".settings_users_actions > .fa-pencil").click();
        cy.get('[id="settings-usersDialogEditUser"]').should("to.visible");
        cy.get(
            '#settings-usersDialogEditUser > .modal-footer > [data-dismiss="modal"]'
        ).click();
        cy.get('[id="settings-usersDialogEditUser"]').should("not.visible");
        cy.get(".fa-key").click();
        cy.get('[id="settings-usersDialogChangePassword"]').should(
            "to.visible"
        );
        cy.get(
            '#settings-usersDialogChangePassword > .modal-footer > [data-dismiss="modal"]'
        ).click();
        cy.get('[id="settings-usersDialogChangePassword"]').should(
            "not.visible"
        );
    });
    it("Access control - link", function () {
        cy.get('[id="settings_users_link"]').click();
        cy.get("#mrb_settings_users_header > .show_only_online > a")
            .invoke("attr", "href")
            .then((myLink) => {
                cy.request(myLink).then((resp) => {
                    expect(resp.status).to.eq(200);
                });
            });
    });
});
