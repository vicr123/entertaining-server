import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

const features = [
    {
        title: 'Freedom',
        imageUrl: 'img/title-freedom.svg',
        description: (
            <>
                Entertaining Games is open source - both the server and the games.<br />And you're not restricted to our server: you could spin up your own Entertaining Games server just for friends.
            </>
        ),
    },
    {
        title: 'Modular',
        imageUrl: 'img/title-modular.svg',
        description: (
            <>
                If you're a developer at heart, Entertaining Games makes it easy to get started with making online games.
            </>
        ),
    },
    {
        title: 'Integrated',
        imageUrl: 'img/title-integrated.svg',
        description: (
            <>
                Your friends follow you around to every Entertaining Games application. It's one spot to get together.
            </>
        ),
    },
];

function Feature({ imageUrl, title, description }) {
    const imgUrl = useBaseUrl(imageUrl);
    return (
        <div className={clsx('col col--4', styles.feature)}>
            {imgUrl && (
                <div className="text--center">
                    <img className={styles.featureImage} src={imgUrl} alt={title} />
                </div>
            )}
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}

function Home() {
    const context = useDocusaurusContext();
    const { siteConfig = {} } = context;
    return (
        <Layout
            title={`${siteConfig.title}`}
            description="Minimum Entertainment">
            {/* <header className={clsx('hero hero--primary', styles.heroBanner)}>
                <div className="container">
                    <h1 className="hero__title">{siteConfig.title}</h1>
                    <p className="hero__subtitle">{siteConfig.tagline}</p>
                    <div className={styles.buttons}>
                        <Link
                            className={clsx(
                                'button button--outline button--secondary button--lg',
                                styles.getStarted,
                            )}
                            to={useBaseUrl('docs/')}>
                            Get Started
            </Link>
                    </div>
                </div>
            </header> */}
            <header>
                <div className="container mainHeader">
                    <h1 className="hero__title">{siteConfig.title}</h1>
                    <img className="logoSplash" src="/img/entertaining-logo.svg"></img>
                    <h2 className="hero__subtitle">{siteConfig.tagline}</h2>
                </div>
            </header>
            <main>
                {features && features.length > 0 && (
                    <section className={styles.features}>
                        <div className="container">
                            <div className="row">
                                {features.map((props, idx) => (
                                    <Feature key={idx} {...props} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}
                <div className="container">
                    <h1>We're still building!</h1>
                    <p>Stay tuned for more information!</p>
                </div>
            </main>
        </Layout>
    );
}

export default Home;
