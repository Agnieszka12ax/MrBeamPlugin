import logging
from frontend import webdriverUtils
from frontend import uiUtils
from frontend.quick_text.base_procedure import BaseProcedure


class TestAlertaStencil(BaseProcedure):
    def setup_method(self, method):

        # expectations (None means skip)
        self.expectedText = {
            "text": "Test",
            "font-family": "Allerta Stencil",
            "fill": "#9b9b9b",
        }
        self.expectedBBox = {
            "x": 228.28125,
            "y": 109.953125,
            "w": 43.4375,
            "h": 24.828125,
        }

        # basics
        self.log = logging.getLogger()
        self.driver = webdriverUtils.get_chrome_driver()
        self.browserLog = []
        self.testEnvironment = {}

    def get_quick_text(self):
        return uiUtils.add_quick_text_alerta_stencil(self.driver, "Test")
