const { MessageActionRow, MessageButton } = require("discord.js");
const { supabase } = require("../database");
const { client } = require("../index");
var starNames = require("@frekyll/star-names");
const dotenv = require("dotenv");
dotenv.config();

const paginationEmbed = async (interaction, pages, senderDiscordIds) => {
  if (!pages) throw new Error("Pages are not given.");
  let page = 0;

  const previousButton = new MessageButton()
    .setCustomId("nextbtn")
    .setLabel("Next")
    .setStyle("PRIMARY");

  const nextButton = new MessageButton()
    .setCustomId("previousbtn")
    .setLabel("Previous")
    .setStyle("SECONDARY");

  const acceptButton = new MessageButton()
    .setCustomId("accept-invite")
    .setLabel("Accept")
    .setStyle("SUCCESS");

  const declineButton = new MessageButton()
    .setCustomId("decline-invite")
    .setLabel("Decline")
    .setStyle("DANGER");

  const buttonList = [nextButton, previousButton, acceptButton, declineButton];

  const row = new MessageActionRow().addComponents(buttonList);

  const curPage = await interaction.editReply({
    embeds: [pages[page].setFooter(`Page ${page + 1} / ${pages.length}`)],
    components: [row],
    fetchReply: true,
  });

  const filter = (i) =>
    i.customId === buttonList[0].customId ||
    i.customId === buttonList[1].customId ||
    i.customId === buttonList[2].customId ||
    i.customId === buttonList[3].customId;

  const collector = await curPage.createMessageComponentCollector({
    filter,
    time: 120000,
  });

  collector.on("collect", async (i) => {
    const inviter = senderDiscordIds[page];
    const invitee = interaction.user.id;
    switch (i.customId) {
      case buttonList[0].customId:
        page = page > 0 ? --page : pages.length - 1;
        break;
      case buttonList[1].customId:
        page = page + 1 < pages.length ? ++page : 0;
        break;
      case buttonList[2].customId:
        const parentChannel = client.channels.cache.get(
          process.env.DISCORD_CHANNEL_ID
        );
        parentChannel.threads
          .create({
            name: `${starNames.random()}`,
            autoArchiveDuration: 60,
            reason: "Needed a separate thread for pairing",
          })
          .then(async (threadChannel) => {
            threadChannel.members.add(inviter);
            threadChannel.members.add(invitee);

            // delete invite record
            const { error } = await supabase
              .from("invites")
              .delete()
              .eq("sender_discord_id", inviter)
              .eq("receiver_discord_id", invitee);

            if (error != null) {
              await interaction.editReply({
                content: "Something went wrong.",
                ephemeral: true,
              });
              return;
            }

            let inviteUser = await client.users.fetch(inviter);
            // Let the inviter know if the user has accepted.
            inviteUser.send({
              content: `${interaction.user.tag} has accepted your invite!`,
            });

            await interaction.followUp({
              content: "Invitation successfully accepted!",
            });
          })
          .catch(async (error) => {
            console.log(error);
            await interaction.editReply({
              content: "Something went wrong",
            });
          });
        break;
      case buttonList[3].customId:
        const { error } = await supabase
          .from("invites")
          .delete()
          .eq("sender_discord_id", inviter)
          .eq("receiver_discord_id", invitee);

        if (error != null) {
          await interaction.editReply({
            content: "Something went wrong.",
            ephemeral: true,
          });

          return;
        }

        await interaction.followUp({
          content: "Invitation successfully declined!",
        });
        break;
      default:
        break;
    }
    await i.deferUpdate();
    await i.editReply({
      embeds: [pages[page].setFooter(`Page ${page + 1} / ${pages.length}`)],
      components: [row],
    });
    collector.resetTimer();
  });

  collector.on("end", () => {
    if (!curPage.deleted) {
      const disabledRow = new MessageActionRow().addComponents(
        buttonList[0].setDisabled(true),
        buttonList[1].setDisabled(true),
        buttonList[2].setDisabled(true)
      );

      interaction.editReply({
        embeds: [pages[page].setFooter(`Page ${page + 1} / ${pages.length}`)],
        components: [disabledRow],
      });
    }
  });

  return curPage;
};
module.exports = paginationEmbed;
