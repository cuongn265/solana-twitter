import { SolanaTwitter } from './../app/src/idl/solana_twitter';
import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { assert } from 'chai';

describe('solana-twitter', () => {
  const sendTweet = async (author, topic, content) => {
    const tweet = anchor.web3.Keypair.generate();
    await program.rpc.sendTweet(topic, content, {
      accounts: {
        tweet: tweet.publicKey,
        author,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [tweet],
    });
    return tweet;
  };
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>;

  it('can send a new tweet', async () => {
    const tweet = anchor.web3.Keypair.generate();

    const tx = await program.rpc.sendTweet('veganism', 'Hummus, am I right?', {
      accounts: {
        tweet: tweet.publicKey,
        author: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [tweet],
    });

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    // console.log('tweet account', tweetAccount);

    assert.equal(
      tweetAccount.author.toBase58(),
      program.provider.wallet.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, 'veganism');
    assert.equal(tweetAccount.content, 'Hummus, am I right?');
    assert.ok(tweetAccount.timestamp);
  });
  it('can send a new tweet without topic', async () => {
    const tweet = anchor.web3.Keypair.generate();

    const tx = await program.rpc.sendTweet('', 'Hummus, am I right?', {
      accounts: {
        tweet: tweet.publicKey,
        author: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [tweet],
    });

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    // console.log('tweet account', tweetAccount);

    assert.equal(
      tweetAccount.author.toBase58(),
      program.provider.wallet.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, '');
    assert.equal(tweetAccount.content, 'Hummus, am I right?');
    assert.ok(tweetAccount.timestamp);
  });
  it('can send a new tweet with different author', async () => {
    const tweet = anchor.web3.Keypair.generate();
    const otherUser = anchor.web3.Keypair.generate();
    const signature = await program.provider.connection.requestAirdrop(
      otherUser.publicKey,
      1000000000
    );
    await program.provider.connection.confirmTransaction(signature);

    await program.rpc.sendTweet('veganism', 'Hummus, am I right?', {
      accounts: {
        tweet: tweet.publicKey,
        author: otherUser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [otherUser, tweet],
    });

    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    // console.log('tweet account', tweetAccount);

    assert.equal(
      tweetAccount.author.toBase58(),
      otherUser.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, 'veganism');
    assert.equal(tweetAccount.content, 'Hummus, am I right?');
    assert.ok(tweetAccount.timestamp);
  });

  it('cannot provide a topic with more than 50 characters', async () => {
    try {
      const tweet = anchor.web3.Keypair.generate();
      const topicWith51Chars = 'x'.repeat(51);

      await program.rpc.sendTweet(topicWith51Chars, 'Hummus, am I right?', {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
      });
    } catch (error) {
      assert.equal(
        error.msg,
        'The provided topic should be 50 characters long maximum.'
      );
      return;
    }
    assert.fail(
      'The instruction should have failed with a 51-character topic.'
    );
  });
  it('cannot provide a content with more than 280 characters', async () => {
    try {
      const tweet = anchor.web3.Keypair.generate();
      const contentWith281Chars = 'x'.repeat(281);
      await program.rpc.sendTweet('veganism', contentWith281Chars, {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
      });
    } catch (error) {
      assert.equal(
        error.msg,
        'The provided content should be 280 characters long maximum.'
      );
      return;
    }

    assert.fail(
      'The instruction should have failed with a 281-character content.'
    );
  });

  it('can fetch all tweets', async () => {
    const tweetAccount = await program.account.tweet.all();
    assert.equal(tweetAccount.length, 3);
  });

  it('can filter tweets by author', async () => {
    const authorPubicKey = program.provider.wallet.publicKey;
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8,
          bytes: authorPubicKey.toBase58(),
        },
      },
    ]);

    assert.equal(tweetAccounts.length, 2);
    assert.ok(
      tweetAccounts.every((tweetAccount) => {
        return (
          tweetAccount.account.author.toBase58() === authorPubicKey.toBase58()
        );
      })
    );
  });
  it('can filter tweets by topics', async () => {
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8 + 32 + 8 + 4,
          bytes: bs58.encode(Buffer.from('veganism')),
        },
      },
    ]);

    assert.equal(tweetAccounts.length, 2);
    assert.ok(
      tweetAccounts.every((tweetAccount) => {
        return tweetAccount.account.topic === 'veganism';
      })
    );
  });
  it('can update a tweet', async () => {
    const author = program.provider.wallet.publicKey;
    const tweet = await sendTweet(author, 'web2', 'hello world!');
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    assert.equal(
      tweetAccount.author.toBase58(),
      program.provider.wallet.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, 'web2');
    assert.equal(tweetAccount.content, 'hello world!');
    assert.ok(tweetAccount.timestamp);

    await program.rpc.updateTweet('solana', 'gm everyone!', {
      accounts: {
        author,
        tweet: tweet.publicKey,
      },
    });

    const updatedTweetAccount = await program.account.tweet.fetch(
      tweet.publicKey
    );
    assert.equal(updatedTweetAccount.topic, 'solana');
    assert.equal(updatedTweetAccount.content, 'gm everyone!');
  });
  it("cannot update someone's else tweet", async () => {
    const author = program.provider.wallet.publicKey;
    const tweet = await sendTweet(author, 'solana', 'Solana is awesome');
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    assert.equal(
      tweetAccount.author.toBase58(),
      program.provider.wallet.publicKey.toBase58()
    );
    assert.equal(tweetAccount.topic, 'solana');
    assert.equal(tweetAccount.content, 'Solana is awesome');
    assert.ok(tweetAccount.timestamp);

    try {
      await program.rpc.updateTweet('eth', 'Etherium is awesome', {
        accounts: {
          author: anchor.web3.Keypair.generate().publicKey,
          tweet: tweet.publicKey,
        },
      });
    } catch (error) {
      const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
      assert.equal(tweetAccount.topic, 'solana');
      assert.equal(tweetAccount.content, 'Solana is awesome');
    }
  });
});
