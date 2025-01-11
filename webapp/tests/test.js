const request = require("supertest");
const app = require("../server");
const chai = require("chai");
const expect = chai.expect;

describe("Authentication Tests", function () {
  describe("Successes", function () {
    it("check healthz endpoint for 200", function (done) {
      request(app)
        .get("/healthz")
        .send()
        .end(function (err, res) {
          expect(res.statusCode).to.be.equal(200);
          done();
        });
    });
  });
});
