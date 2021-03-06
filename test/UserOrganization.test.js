const assert = require('chai').assert,
      ganache = require('ganache-cli'),
      Web3 = require('web3'),
      web3 = new Web3(ganache.provider());

const compiledFactory = require('../ethereum/build/Factory.json');

let accounts,
    factory,
    regularUserOne, // accounts[1]
    regularUserTwo, // accounts [3]
    organizationUserOne, // accounts[2]
    organizationUserTwo // accounts[4]

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  factory = await new web3.eth.Contract(JSON.parse(compiledFactory.interface))
    .deploy({ data: compiledFactory.bytecode })
    .send({ from: accounts[0], gas: '5000000' });

  await factory.methods.set(1, 'ipfsHash').send({ from: accounts[1], gas: '1000000' });
  regularUserOne = await factory.methods.getUser(accounts[1]).call();

  await factory.methods.set(1, 'ipfsHash').send({ from: accounts[3], gas: '1000000' });
  regularUserTwo = await factory.methods.getUser(accounts[3]).call();

  await factory.methods.set(2, 'ipfsHash').send({ from: accounts[2], gas: '1000000' });
  organizationUserOne = await factory.methods.getUser(accounts[2]).call();

  await factory.methods.set(2, 'ipfsHash').send({ from: accounts[4], gas: '1000000' });
  organizationUserTwo = await factory.methods.getUser(accounts[4]).call();
});

describe('Contract: UserOrganization', () => {

  describe('Function: organizationAddMembers(address[] _toAdd)', () => {
    it('should not allow a Regular user to add members', async () => {
      let revert;

      try {
        await factory.methods.organizationAddMembers([accounts[2]]).send({ from: accounts[1], gas: '1000000 '});
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should not allow an Organization to add another Organization as member', async () => {
      let revert;
      
      try {
        await factory.methods.organizationAddMembers([accounts[4]]).send({ from: accounts[2], gas: '1000000 '});
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should not allow an Organization to add a user which is already a member of another Organization', async () => {
      let revert;
      
      // organizationUserOne adds regularUserOne
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000 '});

      try {
        // organizationUserTwo tries to add regularUserOne
        await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[4], gas: '1000000 '});
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should allow an Organization to add members', async () => {
      // get the organization's initial members
      const initialMembers = organizationUserOne[2];

      // add regularUserOne to organizationUserOne
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      // get the new profile
      organizationUserOne = await factory.methods.getUser(accounts[2]).call();

      // get the organization's final members
      const finalMembers = organizationUserOne[2];
      const finalMembersLength = organizationUserOne[2].length;

      // get the user's memberOf
      const memberOf = await factory.methods.memberOf(accounts[1]).call();

      assert.equal(memberOf, accounts[2]);
      assert.equal(1, finalMembersLength);
      assert.notEqual(initialMembers, finalMembers);
    });

    it('should not allow a non-manager to add a member', async () => {
      let revert;
      
      // add regularUserOne (accounts[1]) to the Organization
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        // try to add regularUserTwo from regularUserOne
        await factory.methods.organizationAddMembers([accounts[3]]).send({ from: accounts[1], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should allow an Organization manager to add a member', async () => {
      // add regularUserOne (accounts[1]) to the Organization
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      // make regularUserOne a manager
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      // add regularUserTwo from regularUserOne (now a manager)
      await factory.methods.organizationAddMembers([accounts[3]]).send({ from: accounts[1], gas: '1000000' });

      let memberOf = await factory.methods.memberOf(accounts[3]).call();

      assert.equal(memberOf, accounts[2]);
    });
  });

  describe('Function: organizationRemoveMembers(address[] _toRemove)', () => {
    it('should not allow a Regular (non-member) to remove members', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationRemoveMembers([accounts[1]]).send({ from: accounts[3], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should not allow to remove non-existing members', async () => {
      let revert;

      try {
        await factory.methods.organizationRemoveMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should not allow a non-manager to remove members', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddMembers([accounts[3]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationRemoveMembers([accounts[3]]).send({ from: accounts[1], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should allow an Organization to remove members', async () => {
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddMembers([accounts[3]]).send({ from: accounts[2], gas: '1000000' });

      let initialMemberOf = await factory.methods.memberOf(accounts[3]).call();
      
      organizationUserOne = await factory.methods.getUser(accounts[2]).call();
      let initialMembers = organizationUserOne[2];

      await factory.methods.organizationRemoveMembers([accounts[3]]).send({ from: accounts[2], gas: '1000000' });

      let finalMemberOf = await factory.methods.memberOf(accounts[3]).call();
      let finalMemberIndex = await factory.methods.memberIndex(accounts[3]).call();

      organizationUserOne = await factory.methods.getUser(accounts[2]).call();
      let finalMembers = organizationUserOne[2];

      assert.notEqual(initialMemberOf, finalMemberOf);
      assert.notEqual(initialMembers, finalMembers);
      assert.equal(0, finalMemberIndex);
    });

    it('should allow a manager to remove members', async () => {
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddMembers([accounts[3]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      let initialMemberOf = await factory.methods.memberOf(accounts[3]).call();

      organizationUserOne = await factory.methods.getUser(accounts[2]).call();
      let initialMembers = organizationUserOne[2];

      await factory.methods.organizationRemoveMembers([accounts[3]]).send({ from: accounts[1], gas: '1000000' });

      let finalMemberOf = await factory.methods.memberOf(accounts[3]).call();
      let memberIndex = await factory.methods.memberIndex(accounts[3]).call();

      organizationUserOne = await factory.methods.getUser(accounts[2]).call();
      let finalMembers = organizationUserOne[2];

      assert.notEqual(initialMemberOf, finalMemberOf);
      assert.notEqual(initialMembers, finalMembers);
      assert.equal(0, memberIndex);
    });
  });

  describe('Function: organizationAddManagers(address[] _toAdd)', () => {
    it('should not allow a Regular member to add Manager', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddMembers([accounts[3]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[3], gas: '1000000' })
      } catch (e) {
        revert = e;
      };

      assert.ok(revert instanceof Error);
    });

    it('should not allow an Organization to add a non-member as manager', async () => {
      let revert;
      
      try {
        await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should not allow an Organization to add a manager who is already a manager of another organization', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[3], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should allow an Organization to add a non-manager member as manager', async () => {
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      const managerOf = await factory.methods.managerOf(accounts[1]).call();

      assert.equal(managerOf, accounts[2]);
    });
  });

  describe('Function: organizationRemoveManagers(address[] _toAdd)', () => {
    it('should not allow a Regular member to remove a manager', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1], accounts[3]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationRemoveManagers([accounts[1]]).send({ from: accounts[3], gas: '1000000' })
      } catch (e) {
        revert = e;
      };

      assert.ok(revert instanceof Error);
    });

    it('should not allow an Organization to remove a non-manager Member', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationRemoveManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' })
      } catch (e) {
        revert = e;
      };

      assert.ok(revert instanceof Error);
    });

    it('should not allow an Organization to remove a non-member Manager', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.organizationRemoveManagers([accounts[1]]).send({ from: accounts[4], gas: '1000000' })
      } catch (e) {
        revert = e;
      };

      assert.ok(revert instanceof Error);
    });

    it('should allow an Organization to remove a Manager', async () => {
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      const initialManagerOf = await factory.methods.managerOf(accounts[1]).call();

      assert.equal(initialManagerOf, accounts[2]);

      await factory.methods.organizationRemoveManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' })
      const finalManagerOf = await factory.methods.managerOf(accounts[1]).call();

      assert.notEqual(finalManagerOf, accounts[2]);
    });
  });

  describe('Function: deleteOrganization()', () => {
    it('should not allow a Regular member to delete the Organization', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.deleteOrganization().send({ from: accounts[1], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should not allow a Manager member to delete the Organization', async () => {
      let revert;
      await factory.methods.organizationAddMembers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      try {
        await factory.methods.deleteOrganization().send({ from: accounts[1], gas: '1000000' });
      } catch (e) {
        revert = e;
      }

      assert.ok(revert instanceof Error);
    });

    it('should, for every member, remove all associations with the Organization', async () => {
      await factory.methods.organizationAddMembers([accounts[1], accounts[3]]).send({ from: accounts[2], gas: '1000000' });
      await factory.methods.organizationAddManagers([accounts[1]]).send({ from: accounts[2], gas: '1000000' });

      // get initial member 1 (regularOne) values
      const initialMemberOfOne = await factory.methods.memberOf(accounts[1]).call();
      const initialMemberIndexOne = await factory.methods.memberIndex(accounts[1]).call();
      const initialManagerOfOne = await factory.methods.managerOf(accounts[1]).call();

      // get initial member 2 (regularTwo) values
      const initialMemberOfTwo = await factory.methods.memberOf(accounts[3]).call();
      const initialMemberIndexTwo = await factory.methods.memberIndex(accounts[3]).call();

      // delete the organization
      await factory.methods.deleteOrganization().send({ from: accounts[2], gas: '1000000' });

      // get final member 1 (regularOne) values
      const finalMemberOfOne = await factory.methods.memberOf(accounts[1]).call();
      const finalMemberIndexOne = await factory.methods.memberIndex(accounts[1]).call();
      const finalManagerOfOne = await factory.methods.managerOf(accounts[1]).call();

      // get final member 2 (regularTwo) values
      const finalMemberOfTwo = await factory.methods.memberOf(accounts[3]).call();
      const finalMemberIndexTwo = await factory.methods.memberIndex(accounts[3]).call();

      // check member 1 (regularOne)
      assert.notEqual(initialMemberOfOne, finalMemberOfOne);
      assert.ok(initialMemberIndexOne, finalMemberIndexOne);
      assert.notEqual(initialManagerOfOne, finalManagerOfOne);

      // check member 2 (regularTwo)
      assert.notEqual(initialMemberOfTwo, finalMemberOfTwo);
      assert.notEqual(initialMemberIndexTwo, finalMemberIndexTwo);
    });

    it('should remove the Organization profile', async () => {
      await factory.methods.organizationAddMembers([accounts[1], accounts[3]]).send({ from: accounts[2], gas: '1000000' });

      organizationOne = await factory.methods.getUser(accounts[2]).call();
      const initialRole = organizationOne[0];
      const initialIpfsHash = organizationOne[1];
      const initialMembers = organizationOne[2];

      await factory.methods.deleteOrganization().send({ from: accounts[2], gas: '1000000' });

      organizationOne = await factory.methods.getUser(accounts[2]).call();
      const finalRole = organizationOne[0];
      const finalIpfsHash = organizationOne[1];
      const finalMembers = organizationOne[2];

      assert.notEqual(initialRole, finalRole);
      assert.notEqual(initialIpfsHash, finalIpfsHash);
      assert.notEqual(initialMembers, finalMembers);
    });
  });

});