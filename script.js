
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formSubmit");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectFunction,
            args: [username]
        });
    });


    // Load saved data from storage when popup opens
    chrome.storage.local.get(["iDontFollowBack"], (result) => {
        const output = result.iDontFollowBack;
        if (output && output.length > 0) {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<p>Usernames not following back: ${output.join(", ")}</p>`
            );
        }
    });

});


function injectFunction(username) {

    function getUserNames(usernameList) {
        let result = [];
        for (const user of usernameList) {
            console.log("user: " + user);
            console.log("username: " + user.username);
            result.push(user.username);
        }

        return result;
    }

    console.log("Username: " + username);


    let followers = [{ username: "", full_name: "" }];
    let followings = [{ username: "", full_name: "" }];
    let dontFollowMeBack = [{ username: "", full_name: "" }];
    let iDontFollowBack = [{ username: "", full_name: "" }];

    followers = [];
    followings = [];
    dontFollowMeBack = [];
    iDontFollowBack = [];

    (async () => {
        try {
            console.log(`Process started! Give it a couple of seconds`);

            const userQueryRes = await fetch(
                `https://www.instagram.com/web/search/topsearch/?query=${username}`
            );

            const userQueryJson = await userQueryRes.json();

            const userId = userQueryJson.users.map(u => u.user)
                .filter(
                    u => u.username === username
                )[0].pk;

            let after = null;
            let has_next = true;

            while (has_next) {
                await fetch(
                    `https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=` +
                    encodeURIComponent(
                        JSON.stringify({
                            id: userId,
                            include_reel: true,
                            fetch_mutual: true,
                            first: 50,
                            after: after,
                        })
                    )
                )
                    .then((res) => res.json())
                    .then((res) => {
                        has_next = res.data.user.edge_followed_by.page_info.has_next_page;
                        after = res.data.user.edge_followed_by.page_info.end_cursor;
                        followers = followers.concat(
                            res.data.user.edge_followed_by.edges.map(({ node }) => {
                                return {
                                    username: node.username,
                                    full_name: node.full_name,
                                };
                            })
                        );
                    });
            }

            console.log({ followers });

            after = null;
            has_next = true;

            while (has_next) {
                await fetch(
                    `https://www.instagram.com/graphql/query/?query_hash=d04b0a864b4b54837c0d870b0e77e076&variables=` +
                    encodeURIComponent(
                        JSON.stringify({
                            id: userId,
                            include_reel: true,
                            fetch_mutual: true,
                            first: 50,
                            after: after,
                        })
                    )
                )
                    .then((res) => res.json())
                    .then((res) => {
                        has_next = res.data.user.edge_follow.page_info.has_next_page;
                        after = res.data.user.edge_follow.page_info.end_cursor;
                        followings = followings.concat(
                            res.data.user.edge_follow.edges.map(({ node }) => {
                                return {
                                    username: node.username,
                                    full_name: node.full_name,
                                };
                            })
                        );
                    });
            }

            dontFollowMeBack = followings.filter((following) => {
                return !followers.find(
                    (follower) => follower.username === following.username
                );
            });

            iDontFollowBack = followers.filter((follower) => {
                return !followings.find(
                    (following) => following.username === follower.username
                );
            });

            alert(getUserNames(iDontFollowBack));

            chrome.storage.local.set({ iDontFollowBack: usernames }, () => {
                console.log("Usernames saved to storage:", usernames);
            });

        } catch (err) {
            console.log({ err });
        }
    })();

}


